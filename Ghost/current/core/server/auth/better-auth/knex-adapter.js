"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKnexAdapter = createKnexAdapter;
const adapters_1 = require("better-auth/adapters");
const errors_1 = __importDefault(require("@tryghost/errors"));
const PRIMARY = 'primary';
const joinAlias = (model) => `join_${model}`;
const joinColumnAlias = (model, column) => `_joined_${model}_${column}`;
// MySQL LIKE treats % and _ as wildcards and \ as the escape character
const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);
const toCount = (value) => {
    const count = Number(value ?? 0);
    return count > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : count;
};
function createCustomAdapter(db, { virtualColumns = {}, createDefaults = {} }, inTransaction) {
    return ({ getFieldName, getDefaultModelName, schema }) => {
        // Only columns that back a field in the current schema, so a plugin's
        // virtual column stays dormant (and its tables unread) until enabled
        const virtualsFor = (model) => {
            const virtuals = virtualColumns[model];
            if (!virtuals) {
                return {};
            }
            let fields;
            try {
                fields = schema[getDefaultModelName(model)]?.fields;
            }
            catch {
                return {};
            }
            const columns = new Set(Object.entries(fields ?? {}).map(([field, attr]) => attr.fieldName ?? field));
            return Object.fromEntries(Object.entries(virtuals).filter(([column]) => columns.has(column)));
        };
        const withTransaction = (fn) => inTransaction ? fn(db) : db.transaction((trx) => fn(trx));
        // A column of `table` (aliased as `alias`), or its SQL expression when virtual
        const columnRef = (table, alias, column) => virtualsFor(table)[column]?.(db, alias) ?? db.ref(`${alias}.${column}`);
        const fieldColumn = (modelKey, field) => getFieldName({ model: modelKey, field });
        const stripVirtual = (model, data) => {
            const virtuals = virtualsFor(model);
            return Object.fromEntries(Object.entries(data).filter(([key]) => !(key in virtuals)));
        };
        const selectColumns = (model, alias, columns) => {
            const virtuals = virtualsFor(model);
            const wanted = columns?.length ? columns : null;
            const real = wanted ? wanted.filter((c) => !(c in virtuals)) : [`${alias}.*`];
            const computed = Object.entries(virtuals)
                .filter(([column]) => !wanted || wanted.includes(column))
                .map(([column, expr]) => db.raw('? as ??', [expr(db, alias), column]));
            return [...real.map((c) => (c.endsWith('.*') ? c : `${alias}.${c}`)), ...computed];
        };
        const applyCondition = (qb, model, alias, w, or) => {
            const { value, operator = 'eq', mode = 'sensitive' } = w;
            const column = columnRef(model, alias, fieldColumn(model, w.field));
            const insensitive = mode === 'insensitive' &&
                (typeof value === 'string' ||
                    (Array.isArray(value) && value.every((v) => typeof v === 'string')));
            const lhs = insensitive ? db.raw('LOWER(?)', [column]) : column;
            const rhs = insensitive
                ? Array.isArray(value)
                    ? value.map((v) => v.toLowerCase())
                    : value.toLowerCase()
                : value;
            const where = or ? 'orWhere' : 'where';
            switch (operator) {
                case 'in':
                    return qb[or ? 'orWhereIn' : 'whereIn'](lhs, (Array.isArray(rhs) ? rhs : [rhs]));
                case 'not_in':
                    return qb[or ? 'orWhereNotIn' : 'whereNotIn'](lhs, (Array.isArray(rhs) ? rhs : [rhs]));
                case 'contains':
                    return qb[where](lhs, 'like', `%${escapeLike(String(rhs))}%`);
                case 'starts_with':
                    return qb[where](lhs, 'like', `${escapeLike(String(rhs))}%`);
                case 'ends_with':
                    return qb[where](lhs, 'like', `%${escapeLike(String(rhs))}`);
                case 'eq':
                    return rhs === null
                        ? qb[or ? 'orWhereNull' : 'whereNull'](lhs)
                        : qb[where](lhs, '=', rhs);
                case 'ne':
                    return rhs === null
                        ? qb[or ? 'orWhereNotNull' : 'whereNotNull'](lhs)
                        : qb[where](lhs, '<>', rhs);
                case 'gt':
                    return qb[where](lhs, '>', rhs);
                case 'gte':
                    return qb[where](lhs, '>=', rhs);
                case 'lt':
                    return qb[where](lhs, '<', rhs);
                case 'lte':
                    return qb[where](lhs, '<=', rhs);
                default:
                    throw new errors_1.default.IncorrectUsageError({
                        message: `Unsupported where operator: ${operator}`,
                    });
            }
        };
        // AND conditions are all required; OR conditions form one group that must
        // match at least once, matching Better Auth's other SQL adapters
        const applyWhere = (qb, model, where = [], alias = model) => {
            const and = where.filter((w) => w.connector !== 'OR');
            const or = where.filter((w) => w.connector === 'OR');
            if (and.length) {
                qb.where((b) => {
                    for (const w of and) {
                        applyCondition(b, model, alias, w, false);
                    }
                });
            }
            if (or.length) {
                qb.where((b) => {
                    for (const w of or) {
                        applyCondition(b, model, alias, w, true);
                    }
                });
            }
            return qb;
        };
        const findById = (executor, model, modelKey, id) => executor
            .from(model)
            .select(selectColumns(model, model))
            .where(`${model}.${fieldColumn(modelKey, 'id')}`, id)
            .first();
        // Primary rows go in a subquery so limit/offset apply before joins fan out
        const selectWithJoins = (model, modelKey, build, select, join) => {
            const inner = build(db.from(model).select(selectColumns(model, model, select?.map((f) => fieldColumn(modelKey, f)))));
            if (!join || !Object.keys(join).length) {
                return { query: inner, joined: [] };
            }
            const query = db.from(inner.as(PRIMARY)).select(`${PRIMARY}.*`);
            const joined = [];
            for (const [joinModel, config] of Object.entries(join)) {
                const joinKey = config.modelKey ?? getDefaultModelName(joinModel);
                const alias = joinAlias(joinModel);
                query.leftJoin(`${joinModel} as ${alias}`, `${alias}.${config.on.to}`, `${PRIMARY}.${config.on.from}`);
                const fields = schema[joinKey]?.fields ?? {};
                const columns = [
                    'id',
                    ...Object.entries(fields).map(([field, attr]) => attr.fieldName ?? field),
                ];
                for (const column of new Set(columns)) {
                    query.select(db.raw('? as ??', [
                        columnRef(joinModel, alias, column),
                        joinColumnAlias(joinModel, column),
                    ]));
                    joined.push({ joinModel, column });
                }
            }
            return { query, joined };
        };
        const groupJoinedRows = (rows, modelKey, join, joined) => {
            const idColumn = fieldColumn(modelKey, 'id');
            const grouped = new Map();
            for (const row of rows) {
                const base = { ...row };
                const related = {};
                for (const { joinModel, column } of joined) {
                    const key = joinColumnAlias(joinModel, column);
                    (related[joinModel] ??= {})[column] = row[key];
                    delete base[key];
                }
                const id = base[idColumn];
                if (!grouped.has(id)) {
                    for (const [joinModel, config] of Object.entries(join)) {
                        base[joinModel] = config.relation === 'one-to-one' ? null : [];
                    }
                    grouped.set(id, base);
                }
                const entry = grouped.get(id);
                for (const [joinModel, config] of Object.entries(join)) {
                    const item = related[joinModel];
                    if (!item || !Object.values(item).some((v) => v !== null && v !== undefined)) {
                        continue;
                    }
                    if (config.relation === 'one-to-one') {
                        entry[joinModel] = item;
                        continue;
                    }
                    const list = entry[joinModel];
                    const joinIdColumn = fieldColumn(config.modelKey ?? getDefaultModelName(joinModel), 'id');
                    if (list.length < (config.limit ?? 100) &&
                        !list.some((r) => r[joinIdColumn] === item[joinIdColumn])) {
                        list.push(item);
                    }
                }
            }
            return [...grouped.values()];
        };
        const countRows = async (model, where) => {
            const row = await applyWhere(db.from(model).count({ count: '*' }), model, where).first();
            return toCount(row?.count);
        };
        return {
            async create({ model, modelKey = model, data }) {
                const idColumn = fieldColumn(modelKey, 'id');
                const id = data[idColumn];
                if (id === undefined || id === null) {
                    // Rows are read back by id, so a database-generated id can't be used
                    throw new errors_1.default.IncorrectUsageError({
                        message: `${model}: the Knex adapter needs Better Auth to generate ids (advanced.database.generateId).`,
                    });
                }
                const row = { ...data, [idColumn]: id };
                await db(model).insert(stripVirtual(model, { ...createDefaults[model]?.(row), ...row }));
                return (await findById(db, model, modelKey, id));
            },
            async findOne({ model, modelKey = model, where, select, join }) {
                const { query, joined } = selectWithJoins(model, modelKey, (qb) => applyWhere(qb, model, where).limit(1), select, join);
                const rows = await query;
                if (!rows.length) {
                    return null;
                }
                return (join && joined.length ? groupJoinedRows(rows, modelKey, join, joined)[0] : rows[0]);
            },
            async findMany({ model, modelKey = model, where, limit, select, sortBy, offset, join }) {
                const sort = sortBy && columnRef(model, model, fieldColumn(modelKey, sortBy.field));
                const { query, joined } = selectWithJoins(model, modelKey, (qb) => {
                    applyWhere(qb, model, where);
                    if (sort) {
                        qb.orderBy(sort, sortBy.direction);
                    }
                    if (limit !== undefined) {
                        qb.limit(limit);
                    }
                    if (offset !== undefined) {
                        // MySQL requires a LIMIT alongside OFFSET
                        if (limit === undefined) {
                            qb.limit(Number.MAX_SAFE_INTEGER);
                        }
                        qb.offset(offset);
                    }
                    return qb;
                }, select, join);
                if (sort && joined.length) {
                    query.orderBy(`${PRIMARY}.${fieldColumn(modelKey, sortBy.field)}`, sortBy.direction);
                }
                const rows = await query;
                return (join && joined.length ? groupJoinedRows(rows, modelKey, join, joined) : rows);
            },
            async update({ model, modelKey = model, where, update }) {
                if (!where.length) {
                    return null;
                }
                const idColumn = fieldColumn(modelKey, 'id');
                return withTransaction(async (trx) => {
                    const target = await applyWhere(trx.from(model).select(`${model}.${idColumn}`), model, where)
                        .forUpdate()
                        .first();
                    if (!target) {
                        return null;
                    }
                    const values = stripVirtual(model, update);
                    if (Object.keys(values).length) {
                        await trx(model).where(idColumn, target[idColumn]).update(values);
                    }
                    return ((await findById(trx, model, modelKey, values[idColumn] ?? target[idColumn])) ??
                        null);
                });
            },
            async updateMany({ model, where, update }) {
                const values = stripVirtual(model, update);
                if (!Object.keys(values).length) {
                    return countRows(model, where);
                }
                return toCount(await applyWhere(db(model), model, where).update(values));
            },
            async delete({ model, where }) {
                await applyWhere(db(model), model, where).delete();
            },
            async deleteMany({ model, where }) {
                return toCount(await applyWhere(db(model), model, where).delete());
            },
            async count({ model, where }) {
                return countRows(model, where);
            },
            // MySQL has no DELETE ... RETURNING, so lock, read, then delete
            async consumeOne({ model, modelKey = model, where }) {
                const idColumn = fieldColumn(modelKey, 'id');
                return withTransaction(async (trx) => {
                    const row = await applyWhere(trx.from(model).select(selectColumns(model, model)), model, where)
                        .forUpdate()
                        .first();
                    if (!row) {
                        return null;
                    }
                    const deleted = await trx(model).where(idColumn, row[idColumn]).delete();
                    return (deleted > 0 ? row : null);
                });
            },
            async incrementOne({ model, modelKey = model, where, increment, set }) {
                const idColumn = fieldColumn(modelKey, 'id');
                return withTransaction(async (trx) => {
                    const target = await applyWhere(trx.from(model).select(`${model}.${idColumn}`), model, where)
                        .forUpdate()
                        .first();
                    if (!target) {
                        return null;
                    }
                    const values = stripVirtual(model, { ...(set ?? {}) });
                    for (const [column, delta] of Object.entries(increment)) {
                        values[column] = trx.raw('?? + ?', [column, delta]);
                    }
                    const updated = await applyWhere(trx(model).where(`${model}.${idColumn}`, target[idColumn]), model, where).update(values);
                    if (!updated) {
                        return null;
                    }
                    return ((await findById(trx, model, modelKey, target[idColumn])) ?? null);
                });
            },
        };
    };
}
function createKnexAdapter(options) {
    const { db } = options;
    let lazyOptions = null;
    const config = {
        adapterId: 'ghost-knex',
        adapterName: 'Ghost Knex Adapter',
        debugLogs: options.debugLogs,
        // String ids from advanced.database.generateId only
        supportsNumericIds: false,
        supportsUUIDs: false,
        // Ghost has no native JSON or boolean columns
        supportsJSON: false,
        supportsBooleans: false,
        supportsArrays: false,
        // Better Auth is MySQL-only in Ghost; SQLite is dropped in 7.0
        supportsDates: true,
        // Table names are mapped explicitly through Better Auth's modelName options
        usePlural: false,
    };
    const adapter = (0, adapters_1.createAdapterFactory)({
        adapter: createCustomAdapter(db, options, false),
        config: {
            ...config,
            transaction: (cb) => db.transaction((trx) => cb((0, adapters_1.createAdapterFactory)({
                adapter: createCustomAdapter(trx, options, true),
                config: { ...config, transaction: false },
            })(lazyOptions))),
        },
    });
    return (opts) => {
        lazyOptions = opts;
        return adapter(opts);
    };
}
