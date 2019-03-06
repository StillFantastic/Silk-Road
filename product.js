let mongoose = require("mongoose");

mongoose.Promise = global.Promise;

let Schema = mongoose.Schema;

let ProductSchema = new Schema({
	blockchainId: Number,
	name: String,
	category: String,
	ipfsImageHash: String,
	ipfsDescHash: String,
	price: Number,
	startTime: Number,
	condition: Number,
	buyer: String
});

let ProductModel = mongoose.model("ProductModel", ProductSchema);

module.exports = ProductModel;
