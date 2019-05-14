const
  { pool } = require('../../config/postgres-config'),
  { clientRedis } = require('../../config/redis-config');

class User {
  static async createNewUser(displayName) {
    const client = await pool.connect();

    const { rows } = await client.query(`INSERT INTO "user" ("display_name") 
      VALUES($1) RETURNING *`, [displayName]);

    await clientRedis.hsetAsync(`user-${rows[0].id}-info`, `displayName`, displayName);

    return rows[0];
  }

  static async changeDisplayName(id, displayName) {
    await clientRedis.hsetAsync(`user-${id}-info`, `displayName`, displayName);
    const userInfo = await User.getUserById(id);

    // dont use await here. Otherwise, the program would wait for this call before returning result
    pool.connect().then(client => {
      return client.query(`UPDATE "user" SET "display_name" = $1 WHERE "id" = $2`,
        [displayName, id]);
    });

    return userInfo;
  }

  static async getUserById(id) {
    const userInfo = await clientRedis.hgetallAsync(`user-${id}-info`);
    userInfo.id = id;

    return userInfo;
  }

  static async addUser(id, displayName) {
    await clientRedis.hsetAsync(`user-${id}-info`, `displayName`, displayName);
  }
}

module.exports = {
  User
};