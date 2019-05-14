const uuid_v4 = require('uuid/v4');

const
  { pool } = require('../../config/postgres-config'),
  { clientRedis } = require('../../config/redis-config');

class Room {
  constructor(adminId, name, description) {
    this.adminId = adminId;
    this.name = name;
    this.description = description;

    this.id = null;
    this.members = [] // list of member IDs
  }

  static async createNewRoom(adminId, name, description) {
    const room = new Room(adminId, name, description);

    const roomDb = await room.saveDb();
    room.id = roomDb.id; // set room id

    const roomRedis = await room.saveRedis();

    return room;
  }

  async saveDb() {
    const client = await pool.connect();
    const res = await client.query(`INSERT INTO "room" ("admin_id", "name", "description") VALUES ($1, $2, $3)
        returning *`,
      [this.adminId, this.name, this.description]);

    client.release();
    return res.rows[0];
  }

  async saveRedis() {
    const res = await clientRedis.hmsetAsync([`room-${this.id}-info`, `id`, this.id,
      `name`, this.name, `description`, this.description, `admin-id`, this.adminId]);

    return res;
  }

  async addMember(memberId) {
    const res = await clientRedis.saddAsync([`room-${this.id}-members`, memberId]);

    return res;
  }

  async addMessageDbTransaction(memberId, message, messageId) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(`INSERT INTO "message" ("id", "content", "user_id") 
        VALUES($1, $2, $3) RETURNING *`, [messageId, message, memberId]);

      await client.query(`INSERT INTO "room_message" ("room_id", "message_id") 
        VALUES($1, $2)`, [this.id, rows[0].id]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async addMessage(memberId, message) {
    const messageId = uuid_v4();
    
    await clientRedis.rpushAsync([`room-${this.id}-messages`,messageId]);
    
    await clientRedis.hmsetAsync([`message-${messageId}-info`, `userId`, memberId ,`content`, message]);

    // dont use await here. Otherwise, the program would wait for this call before returning result
    this.addMessageDbTransaction(memberId, message, messageId);
  }

  async getMembers() {
    const memberIds = [] || await clientRedis.smembersAsync(`room-${this.id}-members`);
    const members = memberIds.map(async (id) => {
      const memberInfo = await clientRedis.hgetallAsync(`user-${id}-info`);
      return memberInfo;
    });
    return members;
  }

  async getMessages() {
    const roomMessage = await clientRedis.lrangeAsync([`room-${this.id}-messages`, 0, -1]);
    
    const messagePromise = roomMessage.map(async ele => {
      const messageInfo = await clientRedis.hgetallAsync([`message-${ele}-info`]);
      const userInfo = await clientRedis.hgetallAsync([`user-${messageInfo.userId}-info`]);
      return {
        userInfo,
        message: messageInfo.content
      };
    });

    const messages = await Promise.all(messagePromise);
    return messages;
  }
}

module.exports = {
  Room,
};