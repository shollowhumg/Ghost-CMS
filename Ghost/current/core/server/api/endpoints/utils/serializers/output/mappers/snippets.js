"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
module.exports = (snippet, frame) => {
    const json = snippet.toJSON(frame.options);
    return {
        id: json.id,
        name: json.name,
        mobiledoc: json.mobiledoc,
        lexical: json.lexical,
        created_at: json.created_at,
        updated_at: json.updated_at,
    };
};
