"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftLinksService = void 0;
const zod_1 = require("zod");
const errors_1 = __importDefault(require("@tryghost/errors"));
const codec_1 = require("./codec");
const models_1 = require("./models");
const ensure_transaction_1 = require("../../lib/ensure-transaction");
class GiftLinksService {
    knex;
    recordAction;
    constructor({ knex, recordAction }) {
        this.knex = knex;
        this.recordAction = recordAction;
    }
    async getPost(postId, executor = this.knex) {
        return this.postFrom(postId, await this.postWithLiveLink(executor, postId));
    }
    // Anchored on posts: zero rows means the post itself doesn't exist, not merely that it has
    // no live link.
    postWithLiveLink(executor, postId) {
        return executor('posts')
            .where('posts.id', postId)
            .leftJoin('post_gift_links', 'post_gift_links.post_id', 'posts.id')
            .leftJoin('gift_links', 'gift_links.token', 'post_gift_links.gift_link_token')
            .select(codec_1.giftLinkColumns);
    }
    postFrom(postId, rows) {
        if (rows.length === 0) {
            throw new errors_1.default.NotFoundError({ message: `Post ${postId} does not exist.` });
        }
        const giftLinks = rows
            .filter((row) => row.token !== null)
            .map((row) => zod_1.z.decode(codec_1.giftLinkCodec, row));
        return { id: postId, giftLinks };
    }
    async getPostByToken(token, executor = this.knex) {
        const row = await executor('post_gift_links')
            .join('gift_links', 'gift_links.token', 'post_gift_links.gift_link_token')
            .where('gift_links.token', token)
            .first([
            ...codec_1.giftLinkColumns,
            'post_gift_links.post_id as post_id',
        ]);
        return row ? { id: row.post_id, giftLinks: [zod_1.z.decode(codec_1.giftLinkCodec, row)] } : null;
    }
    /**
     * Returns the post with its live link, minting one if the post has none. Given a transaction as
     * `executor` it joins that transaction; given a plain connection it opens its own.
     */
    async ensure(context, postId, executor = this.knex) {
        return (0, ensure_transaction_1.ensureTransaction)(executor, async (trx) => {
            const existing = await this.lockedPost(trx, postId);
            if (existing.giftLinks.length) {
                return existing;
            }
            const post = await this.mint(trx, postId);
            await this.recordAction(trx, { context, verb: 'add', subject: postId });
            return post;
        });
    }
    /**
     * Replaces the post's live link with a new one. Given a transaction as `executor` it joins that
     * transaction; given a plain connection it opens its own.
     */
    async create(context, postId, executor = this.knex) {
        return (0, ensure_transaction_1.ensureTransaction)(executor, async (trx) => {
            await this.lockedPost(trx, postId);
            const post = await this.mint(trx, postId);
            await this.recordAction(trx, { context, verb: 'reset', subject: postId });
            return post;
        });
    }
    /**
     * Removes every post's live link. The `gift_links` rows are kept as history; only the live
     * association is removed. Given a transaction as `executor` it joins that transaction; given a
     * plain connection it opens its own.
     */
    async removeAll(context, executor = this.knex) {
        return (0, ensure_transaction_1.ensureTransaction)(executor, async (trx) => {
            const removed = await trx('post_gift_links').del();
            if (removed > 0) {
                await this.recordAction(trx, { context, verb: 'remove', subject: null });
            }
            return removed;
        });
    }
    /**
     * The post with its live link, with the post's row locked until `trx` ends, so two requests
     * changing one post's link take turns. A post that does not exist is refused as not found.
     *
     * The link is read with a lock too, after the post's. On MySQL a plain read sees the database
     * as it was at the transaction's first plain read, which in a caller's transaction can be
     * before the post was locked, so a plain read could miss a link that the request holding the
     * lock had just saved. A locking read sees what is committed now.
     */
    async lockedPost(trx, postId) {
        await trx('posts').where('id', postId).forUpdate().first('id');
        return this.postFrom(postId, await this.postWithLiveLink(trx, postId).forUpdate());
    }
    async mint(trx, postId) {
        const link = { token: (0, models_1.generateGiftLinkToken)(), createdAt: new Date() };
        await this.addToHistory(trx, postId, link);
        await this.setLiveLink(trx, postId, link);
        return { id: postId, giftLinks: [link] };
    }
    addToHistory(trx, postId, link) {
        return trx('gift_links').insert({ ...zod_1.z.encode(codec_1.giftLinkCodec, link), post_id: postId });
    }
    setLiveLink(trx, postId, link) {
        return trx('post_gift_links')
            .insert({ post_id: postId, gift_link_token: link.token, created_at: link.createdAt })
            .onConflict('post_id')
            .merge({ gift_link_token: link.token, updated_at: link.createdAt });
    }
}
exports.GiftLinksService = GiftLinksService;
