module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      // react-native-worklets/plugin must stay last (Reanimated 4 requirement).
      'react-native-worklets/plugin',
    ],
  };
};
