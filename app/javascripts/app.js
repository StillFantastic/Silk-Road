import "../stylesheets/app.css";

import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'

const ipfsAPI = require('ipfs-api');
const ipfs = ipfsAPI({host: '127.0.0.1', port: '5001', protocol: 'http'});

import ecommerce_store_artifacts from '../../build/contracts/EcommerceStore.json'

var EcommerceStore = contract(ecommerce_store_artifacts);

var reader;
var rating;

const categories = ["All", "Chinese", "English", "Math", "Physics", "Chemistry", "CS", "Others"];

window.App = {
  start: function() {
    var self = this;

    EcommerceStore.setProvider(web3.currentProvider);

		setInterval(function() {
			if (window.user == null) {
				window.user = web3.eth.accounts[0];
			} else if (window.user != web3.eth.accounts[0]) {
				location.reload();
			}
		}, 100);

		if ($("#categories").length > 0) {
			for (let i = 0; i < categories.length; i++) {
				let cate = $("<a>");
				cate.attr({href: "http://localhost:8080" + "?category=" + categories[i]});
				cate.addClass("category-btn");
				cate.append("<div>" + categories[i] + "</div>");
				$("#categories").append(cate);
			}
		}

		if ($("#mission-details").length > 0) {
			let missionId = new URLSearchParams(window.location.search).get("id");
			renderMissionDetails(parseInt(missionId));
			renderApplicants(parseInt(missionId));
			EcommerceStore.deployed().then(function(instance) {
				return instance.getMissionOwner.call(missionId).then(function(missionOwner) {
					if (missionOwner == web3.eth.accounts[0]) {
						$("#mission-apply").hide();
					}
				});
			});
			renderSolver(missionId);
		} else {
			let category = new URLSearchParams(window.location.search).get("category");
			if (category == "All") {
				window.location.href = "http://localhost:8080";
			}
			renderStore(category);
		}

		$("#add-item-to-store").submit(function(event) {
			const req = $("#add-item-to-store").serialize();
			let params = JSON.parse('{"' + req.replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}');
			let decodedParams = {};
			Object.keys(params).forEach(function(val) {
				decodedParams[val] = decodeURIComponent(params[val]);
			});
			saveMission(decodedParams);	
			event.preventDefault();
		});

		$("#product-image").change(function(event) {
			const file = event.target.files[0];
			reader = new window.FileReader();
			reader.readAsArrayBuffer(file);
		});

		$("#apply-form").submit(function(event) {
			$("#msg").hide();
			let missionId = $("#mission-id").val();
			let desc = $.trim($("#apply-description").val());
			let contact = $.trim($("#apply-contact").val());
			let price = $("#apply-price").val();
			let descLink;
			let contactLink;

			saveTextOnIpfs(desc).then(function(id) {
				descLink = id;
				saveTextOnIpfs(contact).then(function(id) {
					contactLink = id;
					EcommerceStore.deployed().then(function(instance) {
						instance.applyMission(missionId, descLink, contactLink, web3.toWei(price, "ether"), {from: web3.eth.accounts[0]}).then(function(tx) {
							$("#msg").show();
							$("#msg").html("You have successfully applied to the mission");
						});
					}).catch(function(error) {
						console.log(error);
					});
				});
			});

			event.preventDefault();
		});


		$("#release-funds").click(function(event) {
			let missionId = new URLSearchParams(window.location.search).get("id");
			EcommerceStore.deployed().then(function(instance) {
				instance.releaseAmountToSeller(missionId, {from: web3.eth.accounts[0]}).then(function(tx) {
					location.reload();
					$("#msg").html("Your transaction has beem submitted. Please wait few seconds for the confirmation").show();
				}).catch(function(error) {
					console.log(error);
				});
			});
		});

		$("#refund-funds").click(function(event) {
			let missionId = new URLSearchParams(window.location.search).get("id");
			EcommerceStore.deployed().then(function(instance) {
				instance.refundAmountToBuyer(missionId, {from: web3.eth.accounts[0]}).then(function(tx) {
					location.reload();
					$("#msg").html("Your transaction has been submitted. Please wait few seconds for the confirmation").show();
				}).catch(function(error) {
					console.log(error);
				});
			});
		});
		
		$("#rate").hide();

		$(".checked").click(function() {
			starmark(this);
		});

		$("#rating-btn").click(function() {
			let missionId = new URLSearchParams(window.location.search).get("id");
			EcommerceStore.deployed().then(function(instance) {
				instance.giveRate(missionId, rating, {from: web3.eth.accounts[0]}).catch(function(error) {
					console.log(error);
				});
			}).catch(function(error) {
				console.log(error);
			});
		});
		$("#deploybut").click(function(){
			$("#deploymission").show();
		});
		$("#quitshop").click(function(){
			$("#deploymission").hide();
		})
  }
};

function renderProductDetails(productId) {
	EcommerceStore.deployed().then(function(instance) {
		return instance.getProduct.call(productId).then(function(product) {
			$("#product-name").html(product[1]);
			$("#product-price").html(displayPrice(product[5]));
			$("#product-image").html("<img width=400px height=400px src='http://localhost:8081/ipfs/" + product[3] + "'/>");
			$("#product-id").val(product[0]);
			$("#buy-now-price").val(product[5]);
			ipfs.cat(product[4]).then(function(file) {
				let content = file.toString();
				$("#product-desc").append("<div>" + content + "</div>");
			});
			if (product[7] == "0x0000000000000000000000000000000000000000") {
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

function renderMissionDetails(missionId) {
	EcommerceStore.deployed().then(function(instance) {
		return instance.getMission.call(missionId).then(function(mission) {
			$("#product-name").html(mission[1]);
			$("#product-image").html("<img width=300px height=300px src='http://localhost:8081/ipfs/" + mission[3] + "'/>");
			$("#mission-id").val(mission[0]);
			ipfs.cat(mission[4]).then(function(file) {
				let content = file.toString();
				$("#product-desc").append(content);
			});
			if (mission[7] == "0x0000000000000000000000000000000000000000" || (mission[6] != window.user && mission[7] != window.user)) {
				$("#escrow-info").hide();
			} else {
				$("#buy-now").hide();
				instance.escrowInfo.call(missionId).then(function(information) {
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

function saveMission(product) {
	let imageId;
	let textId;
	let contactId;

	saveImageOnIpfs(reader).then(function(id) {
		imageId = id;
		saveTextOnIpfs(product["product-description"]).then(function(id) {
			textId = id;
			saveTextOnIpfs(product["product-contact"]).then(function(id) {
				contactId = id;
				EcommerceStore.deployed().then(function(instance) {
					return instance.addMissionToStore(product["product-name"], product["product-category"],
						imageId, textId, contactId, {from: web3.eth.accounts[0], gas: 4700000});
				}).then(function(tx) {
					window.location.href = "http://localhost:8080/";
				}).catch(function(error) {
					console.log(error);
				});
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

function renderStore(category) {
	EcommerceStore.deployed().then(function(instance) {
		return instance.missionIndex.call();
	}).then(function(index) {
		for (let i = 1; i <= index; i++) {
			renderMission(i, category)
		}
	}).catch(function(error) {
		console.log(error);
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

function renderMission(index, category) {
	var myInstance;
	var myMission;
	let node;
	EcommerceStore.deployed().then(function(instance) {
		myInstance = instance;
		instance.getMission.call(index).then(function(mission) {
			myMission = mission;
			if (category == null || category == mission[2]) {
				node = $("<div>");
				node.addClass("col-sm-3 text-center col-margin-bottom-1");
				node.append("<img src='http://localhost:8081/ipfs/" + mission[3] + "'/>");
				node.append("<div class='title'>" + mission[1] + "</div>");
				node.append("<a href='product.html?id=" + mission[0] + "'>Details</a>");
				if (mission[7] === "0x0000000000000000000000000000000000000000") {
					$("#product-list").append(node);
					myInstance.getMissionOwner.call(myMission[0]).then(function(missionOwner) {
						if (myMission[7] == web3.eth.accounts[0] || missionOwner == web3.eth.accounts[0]) {
							$("#undergoing-mission").append(node);
						}
					});
				} else {
					myInstance.getMissionOwner.call(myMission[0]).then(function(missionOwner) {
						if (myMission[7] == web3.eth.accounts[0] || missionOwner == web3.eth.accounts[0]) {
							$("#finish-mission").append(node);
						}
					});
				}
			}
		});
	}).catch(function(error) {
		console.log(error);
	});
}

function displayPrice(amt) {
  return "&Xi;" + web3.fromWei(amt, 'ether');
}

function renderApplicants(missionId) {
	$("#applicants").hide();
	let myInstance;
	let myMission;
	let myApplicant;
	let applicantId;
	let myMissionOwner;

	EcommerceStore.deployed().then(function(instance) {
		myInstance = instance;
		return instance.getMission.call(missionId).then(function(mission) {
			myMission = mission
			if (mission[7] === "0x0000000000000000000000000000000000000000" && mission[6] === window.user) {
				$("#applicants").show();
				myInstance.getApplicantAmount.call(missionId).then(function(index) {
					for (let i = 0; i < index; i++) {
						myInstance.getApplicant.call(missionId, i).then(function(applicant) {
							myApplicant = applicant;
							applicantId = applicant[0];
							let node = $("<tr>");
							node.append("<td>" + applicant[0] + "</td>");
							node.append("<td>" + web3.fromWei(applicant[4], "ether") + "</td>");
							ipfs.cat(myApplicant[2]).then(function(file) {
								let content = file.toString();
								content = content.replace("\n", "<br>");
								content = content.replace("\r", "<br>");
								node.append("<td>" + content + "</td>");
								ipfs.cat(myApplicant[3]).then(function(file) {
									let content = file.toString();
									content = content.replace("\n", "<br>");
									content = content.replace("\n", "<br>");
									node.append("<td>" + content + "</td>");
									
									myInstance.getMissionOwner.call(missionId).then(function(missionOwner) {
										myMissionOwner = missionOwner;

										myInstance.getRate.call(myApplicant[1]).then(function(rate) {
											let avg = Math.round(rate[0].toNumber() / rate[1].toNumber() * 100) / 100;
											if (rate[1].toNumber() == 0)
												avg = 0;
											node.append("<td>" + avg + "</td>");
											node.append("<td>" + rate[1] + "</td>");
											if (myMissionOwner == web3.eth.accounts[0]) {
												node.append("<td><button class='btn deal-btn' data-id='" + i + "'>Deal</btn></td>");
											}
											$("#applicants").append(node);

											$(".deal-btn").click(function(event) {
												let applicantId = $(this).attr("data-id");
												let missionId = new URLSearchParams(window.location.search).get("id");
												console.log(applicantId, missionId);
												var myInstance;
												EcommerceStore.deployed().then(function(instance) {
													myInstance = instance;
													instance.getApplicant.call(missionId, applicantId).then(function(applicant) {
														myInstance.deal(missionId, applicant[0], {from: web3.eth.accounts[0], value: applicant[4]});
													});
												}).catch(function(error) {
													console.log(error);
												});
											});
										});
									});
								});
							});

						});
					}

				});
			}
		});
	}).catch(function(error) {
		console.log(error);
	});
}

function renderSolver(missionId) {
	var myInstance;
	var myMission;
	var myApplicant;

	EcommerceStore.deployed().then(function(instance) {
		myInstance = instance;
		return instance.getMission.call(missionId);
	}).then(function(mission) {
		myMission = mission;
		if (mission[7] == "0x0000000000000000000000000000000000000000") {
			$("#solver-info").hide();
		} else {
			$("#mission-apply").hide();
		}
		return myInstance.getApplicantAmount.call(missionId);
	}).then(function(index) {
		for (let i = 0; i < index; i++) {
			myInstance.getApplicant.call(missionId, i).then(function(applicant) {
				myApplicant = applicant;
				if (applicant[1] == myMission[7]) {
					myInstance.getMissionOwner.call(myMission[0]).then(function(missionOwner) {
						if (missionOwner == web3.eth.accounts[0] && myMission[8] == false) {
							$("#rate").show();
						}
					});

					let node = $("<tr>");
					node.append("<td>" + applicant[1].substr(0, 6) + ".." + "</td>");
					node.append("<td>" + web3.fromWei(applicant[4], "ether") + "</td>");
					ipfs.cat(applicant[2]).then(function(file) {
						let content = file.toString();
						node.append("<td>" + content + "</td>");
						ipfs.cat(applicant[3]).then(function(file) {
							let content = file.toString();
							node.append("<td>" + content + "</td>");
							myInstance.getRate.call(applicant[1]).then(function(rate) {
								let avg = Math.round(rate[0].toNumber() / rate[1].toNumber() * 100) / 100;
								if (rate[1].toNumber() == 0)
									avg = 0;
								node.append("<td>" + avg + "</td>");
								node.append("<td>" + rate[1] + "</td>");
								$("#solver-table").append(node);
							});
						});
					});
				}
			});
		}
	}).catch(function(error) {
		console.log(error);
	});
}

function starmark(item) {
	let count = $(item).attr("id")[0];
	rating = count;
	let subid = $(item).attr("id").substring(1);
	for (let i = 0; i < 5; i++) {
		if (i < count) {
			document.getElementById((i + 1) + subid).style.color = "orange";
		} else {
			document.getElementById((i + 1) + subid).style.color = "black";
		}
	}
}

window.addEventListener('load', function() {
  if (typeof web3 !== 'undefined') {
    window.web3 = new Web3(web3.currentProvider);
		web3.currentProvider.enable();
  } else {
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:7545"));
  }

	rating = 5;
  App.start();
});
