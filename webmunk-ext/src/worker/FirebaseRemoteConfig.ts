export type FirebaseConfig = {
  surveys: JSON,
  excludedDomains: JSON,
  trackInactiveUsers: boolean,
}

const FirebaseConfigTypes = {};

export function convertConfigValuesToPrimitives(config: Record<string, any>) {
  return Object.entries(config)
    .reduce((map, [key, value]) => {
      let parsedVal;
      switch (FirebaseConfigTypes[key as keyof typeof FirebaseConfigTypes]) {
        case 'number': {
          parsedVal = value.asNumber();
          break;
        }
        case 'boolean': {
          parsedVal = value.asBoolean();
          break;
        }
        default: {
          parsedVal = value.asString();
        }
      }
      map[key as keyof FirebaseConfig] = parsedVal;
      return map;
    }, {} as Record<keyof FirebaseConfig, any>);
}
