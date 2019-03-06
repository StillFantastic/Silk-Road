import "../stylesheets/app.css";

import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'

const ipfsAPI = require('ipfs-api');
const ipfs = ipfsAPI({host: '127.0.0.1', port: '5001', protocol: 'http'});

import ecommerce_store_artifacts from '../../build/contracts/EcommerceStore.json'

var EcommerceStore = contract(ecommerce_store_artifacts);

var reader;

const categories = ["Art","Books","Cameras","Cell Phones & Accessories","Clothing","Computers & Tablets","Gift Cards & Coupons","Musical Instruments & Gear","Pet Supplies","Pottery & Glass","Sporting Goods","Tickets","Toys & Hobbies","Video Games"];

window.App = {
  start: function() {
    var self = this;

    EcommerceStore.setProvider(web3.currentProvider);

		if ($("#product-details").length > 0) {
			let productId = new URLSearchParams(window.location.search).get("id");
			renderProductDetails(parseInt(productId));
		} else {
			renderStore();
		}

		$("#add-item-to-store").submit(function(event) {
			const req = $("#add-item-to-store").serialize();
			let params = JSON.parse('{"' + req.replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}');
			let decodedParams = {};
			Object.keys(params).forEach(function(val) {
				decodedParams[val] = decodeURIComponent(params[val]);
			});
			saveProduct(decodedParams);	
			event.preventDefault();
		});

		$("#product-image").change(function(event) {
			const file = event.target.files[0];
			reader = new window.FileReader();
			reader.readAsArrayBuffer(file);
		});

		$("#buy-now").submit(function(event) {
			$("#msg").hide();
			let sendAmount = $("#buy-now-price").val();
			let productId = $("#product-id").val();
			EcommerceStore.deployed().then(function(instance) {
				instance.buy(productId, {value: sendAmount, from: web3.eth.accounts[0]}).then(function(tx) {
					location.reload();
					$("#msg").show();
					$("#msg").html("You have successfully purchased the product");
				}).catch(function(error) {
					console.log(error);
				});
			});
			event.preventDefault();
		});

		$("#release-funds").click(function(event) {
			let productId = new URLSearchParams(window.location.search).get("id");
			EcommerceStore.deployed().then(function(instance) {
				instance.releaseAmountToSeller(productId, {from: web3.eth.accounts[0]}).then(function(tx) {
					location.reload();
					$("#msg").html("Your transaction has beem submitted. Please wait few seconds for the confirmation").show();
				}).catch(function(error) {
					console.log(error);
				});
			});
		});

		$("#refund-funds").click(function(event) {
			let productId = new URLSearchParams(window.location.search).get("id");
			EcommerceStore.deployed().then(function(instance) {
				instance.refundAmountToBuyer(productId, {from: web3.eth.accounts[0]}).then(function(tx) {
					location.reload();
					$("#msg").html("Your transaction has been submitted. Please wait few seconds for the confirmation").show();
				}).catch(function(error) {
					console.log(error);
				});
			});
		})
  }
};

function renderProductDetails(productId) {
	EcommerceStore.deployed().then(function(instance) {
		return instance.getProduct.call(productId).then(function(product) {
			$("#product-name").html(product[1]);
			$("#product-price").html(displayPrice(product[5]));
			$("#product-image").html("<img width=100 src='http://localhost:8081/ipfs/" + product[3] + "'/>");
			$("#product-id").val(product[0]);
			$("#buy-now-price").val(product[5]);
			ipfs.cat(product[4]).then(function(file) {
				let content = file.toString();
				$("#product-desc").append("<div>" + content + "</div>");
			});
			if (product[8] == "0x0000000000000000000000000000000000000000") {
				$("#escrow-info").hide();
			} else {
				$("#buy-now").hide();
				instance.escrowInfo.call(productId).then(function(information) {
					$("#buyer").html(information[0]);
					$("#seller").html(information[1]);
					$("#arbiter").html(information[2]);
					$("#release-count").html(information[4].toNumber());
					$("#refund-count").html(information[5].toNumber());
				}).catch(function(error) {
					console.log(error.message);
				});
			}
		});
	});
}

function saveProduct(product) {
	
	let imageId;
	let textId;

	saveImageOnIpfs(reader).then(function(id) {
		imageId = id;
		saveTextOnIpfs(product["product-description"]).then(function(id) {
			textId = id;
			EcommerceStore.deployed().then(function(instance) {
				return instance.addProductToStore(product["product-name"], product["product-category"],
					imageId, textId, web3.toWei(product["product-price"], "ether"), Date.parse(product["product-start-time"]) / 1000, product["product-condition"], 
					{from: web3.eth.accounts[0], gas: 4700000});
			}).then(function(tx) {
			}).catch(function(err) {
				console.log(err.message);
			});
		});
	});
}

function saveImageOnIpfs(reader) {
	return new Promise(function(resolve, reject) {
		const buffer = Buffer.from(reader.result);
		ipfs.add(buffer).then(function(response) {
			console.log(response);
			resolve(response[0].hash);
		}).catch(function(err) {
			console.err(err);
			reject(err);
		});
	});
}

function saveTextOnIpfs(text) {
	return new Promise(function(resolve, reject) {
		const buffer = Buffer.from(text, "utf-8");
		ipfs.add(buffer).then(function(response) {
			console.log(response);
			resolve(response[0].hash);
		}).catch(function(err) {
			console.err(err);
			reject(err);
		});
	});
}

function renderStore() {
	// let ecommerceInstance;
	// EcommerceStore.deployed().then(function(instance) {
	// 	ecommerceInstance = instance;
	// 	return instance.productIndex.call();
	// }).then(function(index) {
	// 	for (let i = 1; i <= index; i++) {
	// 		renderProduct(ecommerceInstance, i);
	// 	}
	// });
	
	$.ajax({
		url: "http://localhost:3000/products",
		type: "get",
		contentType: "application/json; charset=utf-8",
		data: {}
	}).done(function(data) {
		data.forEach(function(product) {
			renderProduct(product);
		});
	});
}

function renderProduct(product) {
	let node = $("<div>");
	node.addClass("col-sm-3 text-center col-margin-bottom-1 product");
	node.append("<img src='http://localhost:8081/ipfs/" + product.ipfsImageHash + "'/>");
	node.append("<div class='title'>" + product.name + "</div>");
	node.append("<div>Price: " + displayPrice(product.price) + "</div>");
	node.append("<a href='product.html?id=" + product.blockchainId + "'>Details</a>");
	if (product.buyer === undefined) {
		$("#product-list").append(node);
	} else {
		$("#product-purchased").append(node);
	}
}

/*
  function renderProduct(instance, index) {
	console.log(typeof index);
	instance.getProduct.call(index).then(function(product) {
		let node = $("<div>");
		node.addClass("col-sm-3 text-center col-margin-bottom-1 product");
		node.append("<img src='http://localhost:8081/ipfs/" + product[3] + "'/>");
		node.append("<div class='title'>" + product[1] + "</div>");
		node.append("<div>Price: " + displayPrice(product[5]) + "</div>");
		node.append("<a href='product.html?id=" + product[0] + "'>Details</a>");
		if (product[8] === "0x0000000000000000000000000000000000000000") {
			$("#product-list").append(node);
		} else {
			$("#product-purchased").append(node);
		}
	});
}
*/

function displayPrice(amt) {
  return "&Xi;" + web3.fromWei(amt, 'ether');
}

window.addEventListener('load', function() {
  if (typeof web3 !== 'undefined') {
    window.web3 = new Web3(web3.currentProvider);
  } else {
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:7545"));
  }

  App.start();
});
