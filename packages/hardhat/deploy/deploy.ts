import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHEFutureLove = await deploy("FHEFutureLove", {
    from: deployer,
    log: true,
  });

  console.log(`FHEFutureLove contract: `, deployedFHEFutureLove.address);
};
export default func;
func.id = "deploy_FHEFutureLove"; // id required to prevent reexecution
func.tags = ["FHEFutureLove"];
