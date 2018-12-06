/* eslint-disable require-jsdoc */
'use strict';

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const {BusinessNetworkDefinition, CertificateUtil, IdCard} = require('composer-common');
const path = require('path');
const sha256 = require('js-sha256').sha256;

require('chai').should();

const namespace = 'one.xord.ddi';

const personClass = 'Person';
const bankClass = 'Bank';
const cnicClass = 'Cnic';
const cnicClaimClass = 'CnicClaim';
const requestClass = 'Request';

const acceptRequestTransaction = 'acceptRequest';

const cnicNumber = '4220100000000';
const phoneNumber = '03000000000';
const fullName = 'Salman Khan';
const fatherName = 'Zafar Khan';
const gender = 'MALE';
const country = 'Pakistan';
const dob = '24.11.1996';
const doi = '26.11.2015';
const doe = '26.11.2025';

var person, bank, cnic, cnicClaim, request;

describe('Digital Identity', () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore({type: 'composer-wallet-inmemory'});
    let adminConnection;
    let businessNetworkConnection;

    before(async () => {
        // Embedded connection used for local testing
        const connectionProfile = {
            name: 'embedded',
            'x-type': 'embedded'
        };
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({commonName: 'admin'});

        // PeerAdmin identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: ['PeerAdmin', 'ChannelAdmin']
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const deployerCardName = 'PeerAdmin';
        adminConnection = new AdminConnection({cardStore: cardStore});

        await adminConnection.importCard(deployerCardName, deployerCard);
        await adminConnection.connect(deployerCardName);

        businessNetworkConnection = new BusinessNetworkConnection({cardStore: cardStore});

        const adminUserName = 'admin';
        let adminCardName;
        let businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));

        // Install the Composer runtime for the new business network
        await adminConnection.install(businessNetworkDefinition);

        // Start the business network and configure an network admin identity
        const startOptions = {
            networkAdmins: [
                {
                    userName: adminUserName,
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        const adminCards = await adminConnection.start(businessNetworkDefinition.getName(), businessNetworkDefinition.getVersion(), startOptions);

        // Import the network admin identity for us to use
        adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
        await adminConnection.importCard(adminCardName, adminCards.get(adminUserName));

        // Connect to the business network using the network admin identity
        await businessNetworkConnection.connect(adminCardName);
    });

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    describe('#identity', () => {
        it('should be able to register a new identity', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create registry
            const personRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.' + personClass);

            // Create person
            person = factory.newResource(namespace, personClass, cnicNumber);
            person.phoneNumber = phoneNumber;

            // Add person to registry
            await personRegistry.add(person);

            // Get a new instance and check
            person = await personRegistry.get(person.cnicNumber);
            person.cnicNumber.should.equal(cnicNumber);
        });

        it('should be able to register a new bank', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create registry
            const bankRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.' + bankClass);

            // Create bank
            bank = factory.newResource(namespace, bankClass, bankClass);

            // Add bank to registry
            await bankRegistry.add(bank);

            // Get a new instance and check
            bank = await bankRegistry.get(bank.bankId);
            bank.bankId.should.equal(bankClass);
        });

        it('should be able to create a new CNIC', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create CNIC registry
            const cnicRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + cnicClass);

            // Create CNIC
            cnic = factory.newResource(namespace, cnicClass, cnicNumber);

            // Assign attributes
            cnic.fullName = fullName;
            cnic.fatherName = fatherName;
            cnic.gender = gender;
            cnic.country = country;
            cnic.dob = dob;
            cnic.doi = doi;
            cnic.doe = doe;
            cnic.owner = factory.newRelationship(namespace, personClass, person.$identifier);

            // Add CNIC to registry
            await cnicRegistry.add(cnic);

            // Get new instance of CNIC
            cnic = await cnicRegistry.get(cnic.idNumber);

            // Check new instance of CNIC
            cnic.owner.$identifier.should.equal(person.$identifier);
        });

        it('should be able to create a new CNIC claim', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create CNIC claim registry
            const cnicClaimRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + cnicClaimClass);

            // Compute hash
            let hash = sha256(cnicNumber + fullName + fatherName + gender + country + dob + doi + doe);

            // Create claim
            cnicClaim = factory.newResource(namespace, cnicClaimClass, hash);

            // Assign attributes
            cnicClaim.owner = factory.newRelationship(namespace, personClass, person.$identifier);

            // Add claim to registry
            await cnicClaimRegistry.add(cnicClaim);

            // Get new instance of claim
            cnicClaim = await cnicClaimRegistry.get(hash);

            // Check new instance of claim
            cnicClaim.hash.should.equal(hash);
        });

        it('should be able to create new request', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create request registry
            const requestRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + requestClass);

            // Create request
            request = factory.newResource(namespace, requestClass, requestClass);

            // Assign attributes
            request.cnicNumber = cnicNumber;
            request.status = 'PENDING';
            request.owner = factory.newRelationship(namespace, bankClass, bank.$identifier);

            // Add request to registry
            await requestRegistry.add(request);

            // Get new instance of request
            request = await requestRegistry.get(requestClass);

            // Check new instance of request
            request.requestId.should.equal(requestClass);
        });

        it('should be able to accept the request', async () => {
            // Create factory
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // Create requests registry
            let requestsRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + acceptRequestTransaction);

            // Create acceptRequest transaction
            const acceptRequest = factory.newTransaction(namespace, acceptRequestTransaction);
            acceptRequest.requestId = request.requestId;

            // Submit transaction acceptRequest
            await businessNetworkConnection.submitTransaction(acceptRequest);

            requestsRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + requestClass);

            // Get the result of request
            request = await requestsRegistry.get(request.requestId);

            // Check the status of request
            request.status.should.equal('ACCEPTED');
        });
    });
});