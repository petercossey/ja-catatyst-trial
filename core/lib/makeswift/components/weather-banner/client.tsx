'use client';

import { clsx } from 'clsx';
import { CloudSun, Wind } from 'lucide-react';
import { useMemo } from 'react';
import useSWR from 'swr';
import { z } from 'zod';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_REFRESH_INTERVAL = 15 * 60 * 1000;

const DEFAULT_LOCATION = {
  name: 'Tokyo',
  latitude: 35.6762,
  longitude: 139.6503,
};

const currentWeatherSchema = z.object({
  time: z.string(),
  interval: z.number().optional(),
  temperature: z.number(),
  windspeed: z.number(),
  winddirection: z.number(),
  is_day: z.number().optional(),
  weathercode: z.number(),
});

const currentWeatherUnitsSchema = z
  .object({
    time: z.string(),
    interval: z.string(),
    temperature: z.string(),
    windspeed: z.string(),
    winddirection: z.string(),
    is_day: z.string(),
    weathercode: z.string(),
  })
  .partial();

const openMeteoForecastSchema = z.object({
  current_weather: currentWeatherSchema.optional(),
  current_weather_units: currentWeatherUnitsSchema.optional(),
  timezone_abbreviation: z.string().optional(),
});

type OpenMeteoForecastResponse = z.infer<typeof openMeteoForecastSchema>;

interface Props {
  className?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  showUpdatedTime?: boolean;
  showWind?: boolean;
}

const weatherDescriptions: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

const numberFormatter = new Intl.NumberFormat('en', {
  maximumFractionDigits: 1,
});

async function fetchCurrentWeather(url: string): Promise<OpenMeteoForecastResponse> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsedForecast = openMeteoForecastSchema.safeParse(payload);

  if (!parsedForecast.success) {
    throw new Error('Open-Meteo returned an unexpected response');
  }

  return parsedForecast.data;
}

function formatMeasurement(value: number, unit = '') {
  const formattedValue = numberFormatter.format(value);

  return unit.startsWith('°') ? `${formattedValue}${unit}` : `${formattedValue} ${unit}`.trim();
}

function formatObservationTime(time: string, timezone = '') {
  const [, clock] = time.split('T');
  const formattedClock = clock?.slice(0, 5);

  return [formattedClock, timezone].filter(Boolean).join(' ');
}

function getCompassDirection(degrees: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % directions.length;

  return directions[index] ?? 'N';
}

function getWeatherDescription(code: number) {
  return weatherDescriptions[code] ?? `Weather code ${code}`;
}

function getWeatherUrl(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current_weather: 'true',
    timezone: 'auto',
  });

  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;
}

function normalizeCoordinate(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function WeatherUnavailableBanner({
  className,
  locationName,
  isLoading,
}: {
  className?: string;
  locationName: string;
  isLoading?: boolean;
}) {
  return (
    <section
      aria-label={`${locationName} weather`}
      className={clsx(className, 'border-b border-contrast-100 bg-background')}
    >
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-3 text-sm text-foreground md:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-contrast-100 text-contrast-500">
          <CloudSun aria-hidden="true" size={20} strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-semibold">
            {isLoading ? `${locationName} weather` : 'Weather data unavailable'}
          </p>
          <p className="text-xs text-contrast-500">
            {isLoading
              ? 'Loading current conditions.'
              : `Open-Meteo current conditions for ${locationName} could not be loaded.`}
          </p>
        </div>
      </div>
    </section>
  );
}

export function MSWeatherBanner({
  className,
  latitude,
  longitude,
  locationName = DEFAULT_LOCATION.name,
  showUpdatedTime = true,
  showWind = true,
}: Props) {
  const normalizedLatitude = normalizeCoordinate(latitude, DEFAULT_LOCATION.latitude);
  const normalizedLongitude = normalizeCoordinate(longitude, DEFAULT_LOCATION.longitude);
  const weatherUrl = useMemo(
    () => getWeatherUrl(normalizedLatitude, normalizedLongitude),
    [normalizedLatitude, normalizedLongitude],
  );

  const {
    data: forecast,
    error,
    isLoading,
  } = useSWR<OpenMeteoForecastResponse, Error>(weatherUrl, fetchCurrentWeather, {
    dedupingInterval: OPEN_METEO_REFRESH_INTERVAL,
    refreshInterval: OPEN_METEO_REFRESH_INTERVAL,
    revalidateOnFocus: false,
  });

  if (isLoading) {
    return <WeatherUnavailableBanner className={className} isLoading locationName={locationName} />;
  }

  if (error || !forecast?.current_weather) {
    return <WeatherUnavailableBanner className={className} locationName={locationName} />;
  }

  const { current_weather: currentWeather, current_weather_units: units } = forecast;
  const description = getWeatherDescription(currentWeather.weathercode);
  const observedAt = formatObservationTime(currentWeather.time, forecast.timezone_abbreviation);
  const windDirection = getCompassDirection(currentWeather.winddirection);

  return (
    <section
      aria-label={`${locationName} current weather`}
      className={clsx(className, 'border-b border-contrast-100 bg-accent-highlight')}
    >
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-4 py-3 text-sm text-foreground md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-foreground shadow-sm">
            <CloudSun aria-hidden="true" size={20} strokeWidth={1.75} />
          </span>

          <div className="min-w-0">
            <p className="font-semibold">{locationName} weather</p>
            <p className="truncate text-xs text-contrast-500">
              {description}
              {showUpdatedTime && observedAt ? ` / Updated ${observedAt}` : null}
            </p>
          </div>
        </div>

        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs md:justify-end md:text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-contrast-500">Temp</dt>
            <dd className="font-semibold">
              {formatMeasurement(currentWeather.temperature, units?.temperature)}
            </dd>
          </div>

          {showWind ? (
            <div className="flex items-center gap-1.5">
              <Wind aria-hidden="true" size={16} strokeWidth={1.75} />
              <dt className="text-contrast-500">Wind</dt>
              <dd className="font-semibold">
                {formatMeasurement(currentWeather.windspeed, units?.windspeed)} {windDirection}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}
