// Quick start for the Trust Chain test network: https://test.trustalys.net/testers.html
//
// It proves that your computer reaches every part of the test network, and shows the few lines a
// program needs to use it. Run it in a folder where the SDK is installed:
//
//   npm install @trustalys/trust-chain-sdk
//   node quickstart.js
//
// For your own program, keep steps 1 and 2: read the network's profile, and pass it to connect.
// Everything after that is the same as in the SDK's guides.
//
// Test network only: it may be off at any time, and all data is deleted at each monthly reset.
import { connect, newPasscode } from '@trustalys/trust-chain-sdk';

const NETWORK = 'https://test.trustalys.net/network.json';
// The Qualified vLEI Issuer (QVI) credential schema, one of the six vLEI schemas the network holds.
const QVI_SCHEMA = 'EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao';
const WAIT = { limitMs: 120_000 };

let step = 'reading the network description';
try {
  // Step 1. Read the network's profile: its addresses and witnesses.
  // SDK guide: "Connecting to KERIA", section "Connect with a profile".
  const network = await (await fetch(NETWORK)).json();
  const profile = network.profile;
  console.log(`1. Read the profile of the test network: ${profile.witnesses.length} witnesses.`);

  // Step 2. Connect Alice and Bob, each with a new passcode and a new agent on the network.
  // A passcode unlocks a person's keys: a real application keeps it secret.
  // SDK guide: "Getting started", step 2.
  step = 'connecting to KERIA';
  const alice = await connect({ passcode: await newPasscode(), create: true, profile });
  const bob = await connect({ passcode: await newPasscode(), create: true, profile });
  console.log(`2. Alice and Bob are connected, each with a new agent: ${alice.agentAid} and ${bob.agentAid}.`);

  // Step 3. Each creates an identifier. The network's witnesses confirm it.
  // SDK guide: "Getting started", step 3.
  step = 'creating the identifiers';
  const aliceId = await alice.createIdentifier({ name: 'alice' }, undefined, WAIT);
  const bobId = await bob.createIdentifier({ name: 'bob' }, undefined, WAIT);
  if (aliceId.status !== 'done' || bobId.status !== 'done') {
    throw new Error(`the witnesses did not confirm in time; still waiting for: ${[...aliceId.missing, ...bobId.missing].join(', ')}`);
  }
  const witnesses = aliceId.value.keyState.witnesses.length;
  console.log(`3. Alice and Bob each have an identifier, confirmed by the network's ${witnesses} witnesses.`);

  // Step 4. Alice resolves Bob's OOBI, an address where Bob's key events can be read. Now she
  // knows Bob as a contact. SDK guide: "Getting started", step 4.
  step = 'resolving the OOBI';
  const bobOobi = await bob.getOobi('bob', { kind: 'agent' });
  const contact = await alice.resolveOobi(bobOobi, 'bob', WAIT);
  if (contact.status !== 'done') throw new Error(`Bob's OOBI was not resolved: ${contact.missing.join(', ')}`);
  console.log('4. Alice resolved Bob\'s OOBI: Alice knows Bob.');

  // Step 5. Alice resolves the QVI schema from the network's schema server, and checks that it is
  // the schema expected. SDK guide: "Verifying credentials", section "Fetch the schemas".
  step = 'resolving a schema';
  const schema = await alice.resolveSchema({ oobi: network.schemaServer.oobis[QVI_SCHEMA], expectedSaid: QVI_SCHEMA }, WAIT);
  if (schema.status !== 'done') throw new Error(`the QVI schema was not resolved: ${schema.missing.join(', ')}`);
  console.log('5. Alice resolved the QVI schema from the schema server.');

  // Step 6. The identifiers and their OOBIs, to try from another tool or another computer.
  const aliceOobi = await alice.getOobi('alice', { kind: 'agent' });
  console.log(`6. Alice: ${aliceId.value.aid}\n   OOBI:  ${aliceOobi}`);
  console.log(`   Bob:   ${bobId.value.aid}\n   OOBI:  ${bobOobi}`);
  console.log('Your setup works with the test network. Next: the SDK\'s guides.');
} catch (error) {
  console.log(`Failed while ${step}: ${error?.code ? `${error.code}: ` : ''}${error?.message ?? error}`);
  console.log('If the network does not run now, the main page says so: https://test.trustalys.net');
  process.exitCode = 1;
}
