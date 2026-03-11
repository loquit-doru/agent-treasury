// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../TreasuryVault.sol";
import "../CreditLine.sol";
import "../test/mocks/MockERC20.sol";

/**
 * @title DeploySepolia
 * @notice Full deploy on Sepolia testnet: MockUSDt + TreasuryVault + CreditLine.
 *
 *   Usage (PowerShell):
 *     $env:DEPLOYER_PRIVATE_KEY = "0xac0974..."
 *     forge script contracts/script/DeploySepolia.s.sol:DeploySepolia `
 *       --rpc-url https://ethereum-sepolia-rpc.publicnode.com `
 *       --broadcast --slow
 */
contract DeploySepolia is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Agent = deployer (same WDK seed, account index 0)
        address agentAddress = deployer;

        console.log("Deployer / Agent:", deployer);

        vm.startBroadcast(deployerKey);

        // 1. Deploy mock USDt (no real USDt on Sepolia)
        MockERC20 usdt = new MockERC20();
        console.log("MockUSDt deployed:", address(usdt));

        // 2. Mint USDt — 200k to deployer
        usdt.mint(deployer, 200_000e6);

        // 3. Deploy TreasuryVault (no Aave on Sepolia)
        TreasuryVault vault = new TreasuryVault(address(usdt), address(0));
        console.log("TreasuryVault deployed:", address(vault));

        // 4. Deploy CreditLine (linked to vault)
        CreditLine credit = new CreditLine(address(usdt), address(vault));
        console.log("CreditLine deployed:", address(credit));

        // 5. Grant roles to agent (= deployer)
        vault.grantRole(vault.AGENT_ROLE(), agentAddress);
        vault.grantRole(vault.EXECUTOR_ROLE(), agentAddress);
        credit.grantRole(credit.AGENT_ROLE(), agentAddress);

        // 6. Seed the vault with 50k USDt
        usdt.approve(address(vault), 50_000e6);
        vault.deposit(50_000e6);

        vm.stopBroadcast();

        // Summary — parse these for .env
        console.log("========================================");
        console.log("USDT_ADDRESS=%s", address(usdt));
        console.log("TREASURY_VAULT_ADDRESS=%s", address(vault));
        console.log("CREDIT_LINE_ADDRESS=%s", address(credit));
        console.log("AGENT_ADDRESS=%s", agentAddress);
        console.log("========================================");
        console.log("Vault seeded: 50,000 USDt");
        console.log("Deployer holds: 150,000 USDt");
    }
}
