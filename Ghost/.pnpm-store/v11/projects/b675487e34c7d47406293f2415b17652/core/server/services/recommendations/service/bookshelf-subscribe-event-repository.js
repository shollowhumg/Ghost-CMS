"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookshelfSubscribeEventRepository = void 0;
const bookshelf_repository_1 = require("./bookshelf-repository");
const subscribe_event_1 = require("./subscribe-event");
class BookshelfSubscribeEventRepository extends bookshelf_repository_1.BookshelfRepository {
    sentry;
    logging;
    constructor(Model, deps) {
        super(Model);
        this.sentry = deps.sentry;
        this.logging = deps.logging;
    }
    toPrimitive(entity) {
        return {
            id: entity.id,
            recommendation_id: entity.recommendationId,
            member_id: entity.memberId,
            created_at: entity.createdAt,
        };
    }
    modelToEntity(model) {
        try {
            return subscribe_event_1.SubscribeEvent.create({
                id: model.id,
                recommendationId: model.get('recommendation_id'),
                memberId: model.get('member_id'),
                createdAt: model.get('created_at'),
            });
        }
        catch (err) {
            this.logging.error(err);
            this.sentry?.captureException(err);
            return null;
        }
    }
    getFieldToColumnMap() {
        return {
            id: 'id',
            recommendationId: 'recommendation_id',
            memberId: 'member_id',
            createdAt: 'created_at',
        };
    }
}
exports.BookshelfSubscribeEventRepository = BookshelfSubscribeEventRepository;
