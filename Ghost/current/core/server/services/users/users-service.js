"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const errors_1 = __importDefault(require("@tryghost/errors"));
class UsersService {
    models;
    DomainEvents;
    PostsBulkAddTagsEvent;
    removeAuthorFromRevisions;
    constructor({ models, DomainEvents, PostsBulkAddTagsEvent, removeAuthorFromRevisions, }) {
        this.models = models;
        this.DomainEvents = DomainEvents;
        this.PostsBulkAddTagsEvent = PostsBulkAddTagsEvent;
        this.removeAuthorFromRevisions = removeAuthorFromRevisions;
        this.assignTagToUserPosts = this.assignTagToUserPosts.bind(this);
    }
    /**
     * Lock every user and invalidate their password.
     *
     * Locked users hit `PasswordResetRequiredError` on their next signin
     * attempt; the session endpoint catches that, generates a reset token,
     * and emails the user *in context of their own signin*. That avoids
     * blasting unsolicited "your password has been reset" emails to people
     * who are not actively signing in, while still funnelling everyone
     * through a fresh password before they regain access.
     */
    async lockAll(frameOptions) {
        const lockUsers = async (txOptions) => {
            // Every staff user has their password rotated. user.lock()
            // preserves `inactive` status for suspended users so they remain
            // on the suspended-signin path; everyone else transitions to
            // `locked` and hits the reset-on-signin flow.
            const users = await this.models.User.findAll(txOptions);
            for (const user of users.models) {
                await user.lock(txOptions);
            }
            return users.models;
        };
        const users = frameOptions.transacting
            ? await lockUsers(frameOptions)
            : await this.models.Base.transaction((t) => lockUsers({ ...frameOptions, transacting: t }));
        return { count: users.length };
    }
    async assignTagToUserPosts({ id, context, transacting }) {
        // get author slug
        const author = await this.models.User.findOne({
            id,
        }, {
            id,
            context,
            transacting,
        });
        if (!author) {
            throw new errors_1.default.NotFoundError({ message: `User ${id} not found` });
        }
        // get list of posts that need the tag assigned
        const userPosts = await this.models.Base.knex('posts_authors')
            .transacting(transacting)
            .where('author_id', id)
            .select('post_id')
            .forUpdate();
        let usersPostIds = userPosts.map((p) => p.post_id);
        if (usersPostIds.length === 0) {
            return;
        }
        // create an internal tag to assign to reassigned posts
        // in following format: `#{author_slug}`
        let createdTag = false;
        let tag = await this.models.Tag.findOne({
            slug: `hash-${author.get('slug')}`,
        }, {
            context,
            transacting,
        });
        if (!tag) {
            tag = await this.models.Tag.add({
                slug: `#${author.get('slug')}`,
            }, {
                context,
                transacting,
            });
            createdTag = true;
        }
        const tagId = tag.get('id');
        // filter out posts that already have the tag if we didn't need to create one
        if (!createdTag) {
            const taggedPostIds = await this.models.Base.knex('posts_tags')
                .transacting(transacting)
                .where('tag_id', tagId)
                .whereIn('post_id', usersPostIds)
                .select('post_id')
                .forUpdate();
            const taggedPostIdSet = new Set(taggedPostIds.map((p) => p.post_id));
            usersPostIds = usersPostIds.filter((postId) => !taggedPostIdSet.has(postId));
        }
        if (usersPostIds.length === 0) {
            return;
        }
        // assign tag to posts
        //  do bulk insert for performance reasons
        //  - go ahead and assign sort_order 0 to all of them
        await this.models.Base.knex('posts_tags')
            .transacting(transacting)
            .insert(usersPostIds.map((postId) => ({
            id: new bson_objectid_1.default().toHexString(),
            post_id: postId,
            tag_id: tagId,
            sort_order: 0,
        })));
        // manually add an entry in the Actions table that specifies the number of posts edited; see #bulkAddTags for similar logic
        await this.models.Post.addActions('edited', usersPostIds, { transacting, context });
        // dispatch event to ensure collections are updated
        this.DomainEvents.dispatch(this.PostsBulkAddTagsEvent.create(usersPostIds));
    }
    async destroyUser(frameOptions) {
        return this.models.Post.transactionLockingLinked(async (t) => {
            frameOptions.transacting = t;
            // The user's posts are tagged and reassigned below, so lock them first
            await this.models.Post.lockLinkedForUpdate('posts_authors', 'post_id', { author_id: frameOptions.id }, { transacting: t });
            // null author field for users' post revisions
            await this.removeAuthorFromRevisions(this.models.PostRevision, frameOptions.id, {
                transacting: t,
            });
            // create a #author-slug tag and assign it to their posts
            await this.assignTagToUserPosts({
                id: frameOptions.id,
                context: frameOptions.context,
                transacting: t,
            });
            // reassign posts to owner user
            await this.models.Post.reassignByAuthor({
                id: frameOptions.id,
                context: frameOptions.context,
                transacting: t,
            });
            // delete user
            try {
                await this.models.ApiKey.destroy({
                    ...frameOptions,
                    require: true,
                    destroyBy: {
                        user_id: frameOptions.id,
                    },
                });
            }
            catch (err) {
                if (!(err instanceof this.models.ApiKey.NotFoundError)) {
                    throw err;
                }
            }
            await this.models.User.destroy(Object.assign({ status: 'all' }, frameOptions));
        });
    }
}
exports.UsersService = UsersService;
