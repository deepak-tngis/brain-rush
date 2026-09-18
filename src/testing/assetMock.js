/**
 * Stands in for a bundled asset in the node test environment.
 *
 * Metro resolves `require('…/tap.wav')` to an opaque numeric handle; plain node
 * would try to parse the file as JavaScript. The audio layer only ever passes
 * this value straight back to expo-audio, so any stable number will do.
 */
module.exports = 1;
