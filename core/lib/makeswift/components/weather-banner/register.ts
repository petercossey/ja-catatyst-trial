import { Checkbox, Number, Style, TextInput } from '@makeswift/runtime/controls';

import { runtime } from '~/lib/makeswift/runtime';

import { MSWeatherBanner } from './client';

runtime.registerComponent(MSWeatherBanner, {
  type: 'catalyst-weather-banner',
  label: 'Catalyst / Weather Banner',
  icon: 'layout',
  props: {
    className: Style(),
    locationName: TextInput({ label: 'Location name', defaultValue: 'Tokyo' }),
    latitude: Number({ label: 'Latitude', defaultValue: 35.6762 }),
    longitude: Number({ label: 'Longitude', defaultValue: 139.6503 }),
    showUpdatedTime: Checkbox({ label: 'Show updated time', defaultValue: true }),
    showWind: Checkbox({ label: 'Show wind', defaultValue: true }),
  },
});
