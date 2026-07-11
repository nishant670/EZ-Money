import * as matchers from '@testing-library/react-native/matchers';

expect.extend(matchers);

jest.mock('@expo/vector-icons', () => {
  return {
    MaterialCommunityIcons: () => null,
  };
});

jest.mock('@react-native-community/datetimepicker', () => {
  return {
    __esModule: true,
    default: () => null,
    DateTimePickerAndroid: {
      open: jest.fn(),
    },
  };
});
