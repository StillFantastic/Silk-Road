pragma solidity ^0.5.0;

contract Escrow {
    address payable public buyer;
    address payable public seller;
    address payable public arbiter;
    uint productId;
    uint amount;
    mapping(address => bool) releaseVote;
    mapping(address => bool) refundVote;
    uint public releaseCount;
    uint public refundCount;
    bool public fundsDisbursed;
    address owner;
    
    modifier participants(address payable caller) {
        require(caller == buyer || caller == seller || caller == arbiter);
        _;
    }
    
    modifier firstCall(address payable caller) {
        require(releaseVote[caller] == false);
        require(refundVote[caller] == false);
        _;
    }
    
    modifier ownerOnly() {
        require(msg.sender == owner);
        _;
    }
    
    constructor(uint _productId, address payable _buyer, address payable _seller, address payable _arbiter) public payable {
        productId = _productId;
        buyer = _buyer;
        seller = _seller;
        arbiter = _arbiter;
        amount = msg.value;
        owner = msg.sender;
    }
    
    function escrowInfo() public view returns(address, address, address, bool, uint, uint) {
        return (buyer, seller, arbiter, fundsDisbursed, releaseCount, refundCount);
    }
    
    function releaseAmountToSeller(address payable caller) public ownerOnly participants(caller) firstCall(caller) {
        releaseVote[caller] = true;
        releaseCount++;
        
        if (releaseCount == 2) {
            seller.transfer(amount);
            fundsDisbursed = true;
        }
    }
    
    function refundAmountToBuyer(address payable caller) public ownerOnly participants(caller) firstCall(caller) {
        refundVote[caller] = true;
        refundCount++;
        
        if (refundCount == 2) {
            buyer.transfer(amount);
            fundsDisbursed = true;
        }
    }
}
