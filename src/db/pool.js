const { Pool } = require("pg");

const DEFAULT_DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'travel_app',
  waitForConnections: true,
  connectionLimit: 10,
};

const memoryStore = {
  users: [],
  sites: [],
  ratings: [],
};

function createMemoryPool() {
  return {
    async query(sql, params = []) {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim().toLowerCase();

      if (normalizedSql.startsWith('select * from users where email = ? limit 1')) {
        const [email] = params;
        const user = memoryStore.users.find((entry) => entry.email === email) || null;
        return [[user ? { ...user, preferences: user.preferences } : null]];
      }

      if (normalizedSql.startsWith('select * from users where id = ? limit 1')) {
        const [id] = params;
        const user = memoryStore.users.find((entry) => entry.id === id) || null;
        return [[user ? { ...user, preferences: user.preferences } : null]];
      }

      if (normalizedSql.startsWith('select * from users where verification_token = ? limit 1')) {
        const [token] = params;
        const user = memoryStore.users.find((entry) => entry.verification_token === token) || null;
        return [[user ? { ...user, preferences: user.preferences } : null]];
      }

      if (normalizedSql.startsWith('insert into users')) {
        const [id, email, passwordHash, username, preferences, verificationToken] = params;
        memoryStore.users.push({
          id,
          email,
          password_hash: passwordHash,
          username,
          preferences: typeof preferences === 'string' ? JSON.parse(preferences) : preferences,
          is_verified: false,
          verification_token: verificationToken,
          created_at: new Date().toISOString(),
          role: 'member',
        });
        return [{ affectedRows: 1 }];
      }

      if (normalizedSql.startsWith('update users set is_verified = true, verification_token = null where verification_token = ?')) {
        const [token] = params;
        const target = memoryStore.users.find((entry) => entry.verification_token === token);
        if (!target) {
          return [{ affectedRows: 0 }];
        }
        target.is_verified = true;
        target.verification_token = null;
        return [{ affectedRows: 1 }];
      }

      if (normalizedSql.startsWith('select s.*, coalesce(avg(r.rating), 0) as average_rating from sites s left join ratings r on r.site_id = s.id where s.id = ? group by s.id')) {
        const [id] = params;
        const site = memoryStore.sites.find((entry) => entry.id === id) || null;
        if (!site) {
          return [[]];
        }
        const ratings = memoryStore.ratings.filter((rating) => rating.site_id === site.id);
        return [[{
          ...site,
          average_rating: ratings.length
            ? ratings.reduce((sum, rating) => sum + Number(rating.rating), 0) / ratings.length
            : 0,
        }]];
      }

      if (normalizedSql.startsWith('select s.*, coalesce(avg(r.rating), 0) as average_rating')) {
        const siteRows = memoryStore.sites.map((site) => {
          const ratings = memoryStore.ratings.filter((rating) => rating.site_id === site.id);
          const averageRating = ratings.length
            ? ratings.reduce((sum, rating) => sum + Number(rating.rating), 0) / ratings.length
            : 0;

          return {
            ...site,
            average_rating: averageRating,
          };
        });

        const limit = Number(params[params.length - 2] || siteRows.length);
        const offset = Number(params[params.length - 1] || 0);
        const searchValue = params.find((value) => typeof value === 'string' && value.includes('%'));
        const categoryValue = params.find((value) => typeof value === 'string' && !value.includes('%'));

        const querySearch = searchValue ? searchValue.replace(/%/g, '').toLowerCase() : '';
        const queryCategory = categoryValue || null;

        const rows = siteRows.filter((site) => {
          const matchesSearch = !querySearch || (site.title || '').toLowerCase().includes(querySearch) || (site.location || '').toLowerCase().includes(querySearch);
          const matchesCategory = !queryCategory || (site.category || '').toLowerCase() === queryCategory.toLowerCase();
          return matchesSearch && matchesCategory;
        });

        const pagedRows = rows.slice(offset, offset + limit);
        return [pagedRows];
      }

      if (normalizedSql.startsWith('insert into sites')) {
        const [id, title, description, location, category, author, imageUrl, difficulty, dangerosity, price, userId] = params;
        memoryStore.sites.push({
          id,
          title,
          description,
          location,
          category,
          author,
          image_url: imageUrl,
          difficulty,
          dangerosity,
          price,
          user_id: userId,
          created_at: new Date().toISOString(),
        });
        const created = memoryStore.sites.find((entry) => entry.id === id);
        return [[created]];
      }

      if (normalizedSql.startsWith('insert into ratings')) {
        const [siteId, rating] = params;
        memoryStore.ratings.push({ site_id: siteId, rating });
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Unsupported in-memory SQL query: ${normalizedSql}`);
    },
    async end() {
      return Promise.resolve();
    },
  };
}

const mysqlPool = mysql.createPool(DEFAULT_DB_CONFIG);
const memoryPool = createMemoryPool();
let fallbackMode = false;

const pool = {
  async query(sql, params = []) {
    try {
      return await mysqlPool.query(sql, params);
    } catch (error) {
      if (error?.code === 'ECONNREFUSED' || error?.code === 'ER_BAD_DB_ERROR' || error?.code === 'ENOTFOUND') {
        fallbackMode = true;
        return await memoryPool.query(sql, params);
      }
      throw error;
    }
  },
  async end() {
    await mysqlPool.end();
    return Promise.resolve();
  },
  isFallbackMode() {
    return fallbackMode;
  },
};

module.exports = pool;