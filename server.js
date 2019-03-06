const express = require("express");
const Web3 = require("web3");
const ecommerce_store_artifacts = require("./build/contracts/EcommerceStore.json");
const contract = require("truffle-contract");
const provider = new Web3.providers.HttpProvider("http://localhost:7545");
const EcommerceStore = contract(ecommerce_store_artifacts);
EcommerceStore.setProvider(provider);

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const ProductModel = require("./product.js");
mongoose.connect("mongodb://localhost:27017/ebay_dapp");
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB	connection error"));

let app = express();

app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});
app.listen(3000, function() {
	console.log("Ebay on ethereum server listening on port 3000");
});

app.get("/products", function(req, res) {
	let query = {};
	if (req.query.category !== undefined) {
		query["category"] = {$eq: req.query.category};
	}

	ProductModel.find(query, null, {sort: "startTime"}, function(err, items) {
		res.send(items);
	});
});

app.get("/", function(req, res) {
	res.send("Hello, Bill!");
});

setupProductEventListener();
purchaseProductEventListener();

function setupProductEventListener() {
	let productEvent;
	EcommerceStore.deployed().then(function(instance) {
		productEvent = instance.NewProduct({fromBlock: 0, toBlock: "latest"});
		productEvent.watch(function(err, result) {
			if (err) {
				console.log(err);
				return;
			}
			saveProduct(result.args);
		});
	});
}

function saveProduct(product) {
	ProductModel.findOne({"blockchainId": product._productId.toNumber()}, function(err, dbProduct) {
		if (dbProduct != null)
			return;
		let p = new ProductModel({blockchainId: product._productId, name: product._name,
			category: product._category, ipfsImageHash: product._imageLink, ipfsDescHash: product._descLink, price: product._price, startTime: product._startTime, condition: product._condition});

		p.save(function(err) {
			if (err) 
				console.log(err);
		});
	});
}

function purchaseProductEventListener() {
	let productEvent;
	EcommerceStore.deployed().then(function(instance) {
		productEvent = instance.PurchaseProduct({fromBlock: 0, toBlock: "latest"});
		productEvent.watch(function(err, result) {
			if (err) 
				console.log(err);
			else {
				purchaseProduct(result.args);
			}
		});
	});
}

function purchaseProduct(product) {
	ProductModel.findOne({blockchainId: product._productId.toNumber()}, function(err, dbProduct) {
		if (err)
			console.log(err);
		dbProduct.buyer = product._buyer;
		dbProduct.save(function(err, updatedProduct) {
			if (err)
				console.log(err);
		});
	});
}

