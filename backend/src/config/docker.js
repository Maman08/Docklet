const Docker=require('dockerode');
const logger=require('../utils/logger');

const docker = new Docker({
    socketPath:process.env.DOCKER_SOCKET || '/var/run/docker.sock'
});

const initializeDocker=async()=>{
    try{
        const info=await docker.info();
        logger.info('Docker connection established')
        logger.info(`Docker version: ${info.ServerVersion}`);
        await createNetworkIfNotExists();
        return docker;
    }catch(error){
        logger.error('Failed to connect to Docker:', error);
        throw error;
    }
};

const createNetworkIfNotExists=async()=>{
    try{
        const networkName = process.env.DOCKER_NETWORK || 'task-network';
        const networks = await docker.listNetworks();
        const existingNetwork = networks.find(net => net.Name === networkName);
        if (!existingNetwork) {
            logger.info(`Creating Docker network: ${networkName}`);
            await docker.createNetwork({ Name: networkName ,Driver: 'bridge' });
            logger.info(`Network ${networkName} created successfully`);
        }
    }catch(error){
        logger.error('Failed to create Docker network:', error);
        throw error;
    }
}


module.exports = {
    initializeDocker,
    docker
};