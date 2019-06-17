pragma solidity ^0.5.0;

import "./Escrow.sol";

contract EcommerceStore {
    uint public missionIndex;
    uint public applicantIndex;
    
    address payable public arbiter;

    mapping(address => mapping(uint => Mission)) stores;
    mapping(uint => address payable) missionOwner;
    mapping(uint => address) missionEscrow;
    mapping(uint => Applicant[]) candidates;
    mapping(uint => uint) applicantAmount;
    mapping(uint => Applicant) applicantById;
    mapping(address => uint) rateSum;
    mapping(address => uint) rateAmount;
    
    struct Mission {
        uint id;
        string name;
        string category;
        string imageLink;
        string descLink;
        string contactLink;
        address payable addr;
        address payable solver;
        bool giveRate;
    }
    
    struct Applicant {
        uint id;
        address payable addr;
        string descLink;
        string contactLink;
        uint price;
    }
    
    constructor(address payable _arbiter) public {
        missionIndex = 0;
    arbiter = _arbiter;
    }
    
    function addMissionToStore(string memory _name, string memory _category, string memory _imageLink, 
        string memory _descLink, string memory _contactLink) public {
        missionIndex++;
        Mission memory mission = Mission(missionIndex, _name, _category, _imageLink, _descLink, _contactLink,
            msg.sender, address(0), false);
        stores[msg.sender][missionIndex] = mission;
        missionOwner[missionIndex] = msg.sender;
    }
    
    function getMission(uint _missionId) public view returns(uint, string memory, string memory, string memory,
        string memory, string memory, address, address, bool) {
        Mission memory mission = stores[missionOwner[_missionId]][_missionId];
        return (mission.id, mission.name, mission.category, mission.imageLink, mission.descLink,
            mission.contactLink, mission.addr, mission.solver, mission.giveRate);
    }

    function applyMission(uint _missionId, string memory _descLink, string memory _contactLink, uint _price) public {
        require(missionOwner[_missionId] != msg.sender);
        
        Mission memory mission = stores[missionOwner[_missionId]][_missionId];
        require(mission.solver == address(0));
        
        applicantIndex++;
        Applicant memory applicant = Applicant(applicantIndex, msg.sender, _descLink, _contactLink, _price);
        applicantById[applicantIndex] = applicant;
        applicantAmount[_missionId]++;
        candidates[_missionId].push(applicant);
    }
    
    function getApplicant(uint _missionId, uint index) public view returns(uint, address, string memory, string memory,
        uint) {
        require(index < applicantAmount[_missionId]);
        
        Applicant memory applicant = candidates[_missionId][index];
        applicant = applicantById[applicant.id];
        return (applicant.id, applicant.addr, applicant.descLink, applicant.contactLink, applicant.price);
    }
    
    function deal(uint _missionId, uint _applicantId) public payable {
        require(msg.sender == missionOwner[_missionId]);
        require(msg.value >= applicantById[_applicantId].price);
        
        Mission memory mission = stores[missionOwner[_missionId]][_missionId];
        mission.solver = applicantById[_applicantId].addr;
        stores[missionOwner[_missionId]][_missionId] = mission;
        Escrow escrow = (new Escrow).value(msg.value)(_missionId, msg.sender, mission.solver, arbiter);
        missionEscrow[_missionId] = address(escrow);
    }
    
    function giveRate(uint _missionId, uint rate) public {
        Mission memory mission = stores[missionOwner[_missionId]][_missionId];
        require(mission.giveRate == false);
        require(rate <= 5 && rate >= 1);
        require(msg.sender == missionOwner[_missionId]);
        mission.giveRate = true;
        stores[missionOwner[_missionId]][_missionId] = mission;
        rateSum[mission.solver] += rate;
        rateAmount[mission.solver]++;
    }
    
    function getRate(address addr) public view returns (uint, uint) {
        return (rateSum[addr], rateAmount[addr]);
    }

    function getApplicantAmount(uint _missionId) public view returns (uint) {
        return applicantAmount[_missionId];    
    }
    
    function getMissionOwner(uint _missionId) public view returns (address) {
        return missionOwner[_missionId];
    }
    
	function escrowInfo(uint _productId) public view returns(address, address, address, bool, uint, uint) {
		return Escrow(missionEscrow[_productId]).escrowInfo();
	}

	function releaseAmountToSeller(uint _missionId) public {
		Escrow(missionEscrow[_missionId]).releaseAmountToSeller(msg.sender);
	}

	function refundAmountToBuyer(uint _missionId) public {
		Escrow(missionEscrow[_missionId]).refundAmountToBuyer(msg.sender);
	}
}

