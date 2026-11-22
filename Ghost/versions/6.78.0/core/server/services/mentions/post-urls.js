"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPostUrlHelpers = createPostUrlHelpers;
/**
 * Resolves the post data and URL the sender captures for a post or page
 * event, through the URL service and the API serializer's URL helper.
 */
function createPostUrlHelpers({ urlService, forPost }) {
    // Serializes a post model to the data the URL service needs, loading the
    // relations it reads for filtered collections (event-emitted models don't
    // reliably carry them).
    async function getPostData(post) {
        const missing = urlService
            .getRequiredRelations()
            .filter((relation) => !post.relations[relation]);
        if (missing.length) {
            await post.load(missing);
        }
        return post.toJSON();
    }
    function getPostUrl(id, postData) {
        const jsonModel = { ...postData };
        // The URL service routes by resource type. Pages and posts share the Post
        // model, so the page's own type must reach forPost — otherwise it defaults
        // to 'posts', matches no post collection, and 404s.
        const type = postData.type === 'page' ? 'pages' : 'posts';
        forPost(id, jsonModel, { options: {} }, type);
        return jsonModel.url;
    }
    return { getPostData, getPostUrl };
}
