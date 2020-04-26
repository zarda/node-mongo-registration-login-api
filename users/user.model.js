const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    username: { type: String, unique: true, required: true },
    hash: { type: String, required: true },
    createdDate: { type: Date, default: Date.now },
    email: { type: String, required: true },
    inventory: { type: Array, "default": [], required: false },
});

schema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', schema);