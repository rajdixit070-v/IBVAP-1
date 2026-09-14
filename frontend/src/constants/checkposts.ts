export interface CheckpostItem {
  id: string;
  name: string;
  code: string;
  sector: string;
  state: string;
  type: string;
  latitude?: number;
  longitude?: number;
}

export const COMPREHENSIVE_CHECKPOSTS: CheckpostItem[] = [
  // Punjab Frontier (Indo-Pak Border)
  {
    id: 'BOP-WAGAH',
    name: 'Attari-Wagah Joint Check Post',
    code: 'WAGAH',
    sector: 'Punjab Frontier',
    state: 'Punjab',
    type: 'BOP',
    latitude: 31.6048,
    longitude: 74.5731
  },
  {
    id: 'BOP-HUSSAINIWALA',
    name: 'Hussainiwala Joint Checkpost',
    code: 'HUSSAINI',
    sector: 'Punjab Frontier',
    state: 'Punjab',
    type: 'BOP',
    latitude: 30.9328,
    longitude: 74.6052
  },
  {
    id: 'BOP-SADQI',
    name: 'Sadqi Border Checkpost (Fazilka)',
    code: 'SADQI',
    sector: 'Punjab Frontier',
    state: 'Punjab',
    type: 'BOP',
    latitude: 30.3842,
    longitude: 73.9786
  },
  {
    id: 'BOP-KHEMKARAN',
    name: 'Khemkaran Asal Uttar Outpost',
    code: 'KHEMKARAN',
    sector: 'Punjab Frontier',
    state: 'Punjab',
    type: 'BOP',
    latitude: 31.1578,
    longitude: 74.5662
  },
  {
    id: 'BOP-DBN',
    name: 'Dera Baba Nanak Border Post',
    code: 'DBN',
    sector: 'Punjab Frontier',
    state: 'Punjab',
    type: 'BOP',
    latitude: 32.0360,
    longitude: 75.0298
  },
  {
    id: 'BOP-AJNALA',
    name: 'Ajnala Border Outpost',
    code: 'AJNALA',
    sector: 'Punjab Frontier',
    state: 'Punjab',
    type: 'BOP',
    latitude: 31.8402,
    longitude: 74.7601
  },
  {
    id: 'BOP-GURDASPUR',
    name: 'Dorangla Border Post (Gurdaspur)',
    code: 'DORANGLA',
    sector: 'Punjab Frontier',
    state: 'Punjab',
    type: 'BOP',
    latitude: 32.0415,
    longitude: 75.2910
  },
  {
    id: 'BOP-KAHNUWAN',
    name: 'Kahnuwan Sector Outpost',
    code: 'KAHNUWAN',
    sector: 'Punjab Frontier',
    state: 'Punjab',
    type: 'BOP',
    latitude: 31.9542,
    longitude: 75.3812
  },

  // Rajasthan Desert Frontier (Thar Sector)
  {
    id: 'BOP-LONGEWALA',
    name: 'Longewala Desert Outpost',
    code: 'LONGEWALA',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 27.5255,
    longitude: 70.1558
  },
  {
    id: 'BOP-MUNABAO',
    name: 'Munabao Border Checkpost (Barmer)',
    code: 'MUNABAO',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 25.7197,
    longitude: 70.2520
  },
  {
    id: 'BOP-TANOT',
    name: 'Tanot Mata Border Post',
    code: 'TANOT',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 27.8016,
    longitude: 70.3541
  },
  {
    id: 'BOP-JAISALMER',
    name: 'Ramgarh Border Checkpost (Jaisalmer)',
    code: 'RAMGARH',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 27.3512,
    longitude: 70.5218
  },
  {
    id: 'BOP-KISHANGARH',
    name: 'Kishangarh Desert Outpost',
    code: 'KISHANGARH',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 27.7842,
    longitude: 70.4120
  },
  {
    id: 'BOP-SHAHGARH',
    name: 'Shahgarh Bulge Forward Outpost',
    code: 'SHAHGARH',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 27.1235,
    longitude: 70.0214
  },
  {
    id: 'BOP-SADHEWALA',
    name: 'Sadhewala Desert Outpost',
    code: 'SADHEWALA',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 27.6035,
    longitude: 70.2038
  },
  {
    id: 'BOP-NACHNA',
    name: 'Nachna Sub-Sector Post',
    code: 'NACHNA',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 27.3965,
    longitude: 70.1918
  },
  {
    id: 'BOP-HINDUMALKOT',
    name: 'Hindumalkot Border Outpost',
    code: 'HINDUMAL',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 27.5765,
    longitude: 70.1408
  },
  {
    id: 'BOP-KHAJUWALA',
    name: 'Khajuwala Border Post (Bikaner)',
    code: 'KHAJUWALA',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 28.3850,
    longitude: 72.5420
  },
  {
    id: 'BOP-ANUPGARH',
    name: 'Anupgarh Desert Outpost',
    code: 'ANUPGARH',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 27.5465,
    longitude: 70.1978
  },
  {
    id: 'BOP-BAJJU',
    name: 'Bajju Sector Outpost',
    code: 'BAJJU',
    sector: 'Rajasthan Frontier',
    state: 'Rajasthan',
    type: 'BOP',
    latitude: 27.4835,
    longitude: 70.0418
  },

  // Gujarat Frontier (Rann of Kutch & Sir Creek)
  {
    id: 'BOP-HARAMI-NALA',
    name: 'Harami Nala Creek Outpost',
    code: 'HARAMI',
    sector: 'Gujarat Frontier',
    state: 'Gujarat',
    type: 'BOP',
    latitude: 23.8560,
    longitude: 68.6740
  },
  {
    id: 'BOP-SIR-CREEK',
    name: 'Sir Creek Maritime Forward Post',
    code: 'SIRCREEK',
    sector: 'Gujarat Frontier',
    state: 'Gujarat',
    type: 'BOP',
    latitude: 23.7540,
    longitude: 68.5820
  },
  {
    id: 'BOP-KHAVDA',
    name: 'Khavda Border Post (Greater Rann)',
    code: 'KHAVDA',
    sector: 'Gujarat Frontier',
    state: 'Gujarat',
    type: 'BOP',
    latitude: 23.8410,
    longitude: 69.7280
  },
  {
    id: 'BOP-VIGHAKOT',
    name: 'Vighakot Desert Post',
    code: 'VIGHAKOT',
    sector: 'Gujarat Frontier',
    state: 'Gujarat',
    type: 'BOP',
    latitude: 24.2831,
    longitude: 69.3142
  },
  {
    id: 'BOP-LAKHPAT',
    name: 'Lakhpat Coastal Outpost',
    code: 'LAKHPAT',
    sector: 'Gujarat Frontier',
    state: 'Gujarat',
    type: 'BOP',
    latitude: 23.8294,
    longitude: 68.7842
  },
  {
    id: 'BOP-DHARAMSALA',
    name: 'Dharamsala Desert Outpost',
    code: 'DHARAMSALA',
    sector: 'Gujarat Frontier',
    state: 'Gujarat',
    type: 'BOP',
    latitude: 23.7240,
    longitude: 68.6230
  },
  {
    id: 'BOP-BELAKOT',
    name: 'Bela Kot Border Post',
    code: 'BELAKOT',
    sector: 'Gujarat Frontier',
    state: 'Gujarat',
    type: 'BOP',
    latitude: 23.7990,
    longitude: 68.6890
  },

  // Jammu & Kashmir Frontier (IB & LoC)
  {
    id: 'BOP-RS-PURA',
    name: 'RS Pura Border Checkpost',
    code: 'RSPURA',
    sector: 'Jammu & Kashmir',
    state: 'J&K',
    type: 'BOP',
    latitude: 32.6050,
    longitude: 74.7210
  },
  {
    id: 'BOP-SUCHETGARH',
    name: 'Suchetgarh Joint Check Post',
    code: 'SUCHETGARH',
    sector: 'Jammu & Kashmir',
    state: 'J&K',
    type: 'BOP',
    latitude: 32.6105,
    longitude: 74.6980
  },
  {
    id: 'BOP-SAMBA',
    name: 'Samba Sector Outpost',
    code: 'SAMBA',
    sector: 'Jammu & Kashmir',
    state: 'J&K',
    type: 'BOP',
    latitude: 32.5925,
    longitude: 74.7670
  },
  {
    id: 'BOP-HIRANAGAR',
    name: 'Hiranagar Border Post (Kathua)',
    code: 'HIRANAGAR',
    sector: 'Jammu & Kashmir',
    state: 'J&K',
    type: 'BOP',
    latitude: 32.4510,
    longitude: 75.2721
  },
  {
    id: 'BOP-AKHNOOR',
    name: 'Akhnoor Chicken Neck Post',
    code: 'AKHNOOR',
    sector: 'Jammu & Kashmir',
    state: 'J&K',
    type: 'BOP',
    latitude: 32.8984,
    longitude: 74.7420
  },
  {
    id: 'BOP-POONCH',
    name: 'Chakan Da Bagh Trade Post',
    code: 'POONCH',
    sector: 'Jammu & Kashmir',
    state: 'J&K',
    type: 'BOP',
    latitude: 33.7712,
    longitude: 74.0952
  },
  {
    id: 'BOP-URI',
    name: 'Kaman Aman Setu Post (Uri)',
    code: 'URI',
    sector: 'Jammu & Kashmir',
    state: 'J&K',
    type: 'BOP',
    latitude: 34.0886,
    longitude: 74.0416
  },
  {
    id: 'BOP-TANGDHAR',
    name: 'Tangdhar Forward Post (Kupwara)',
    code: 'TANGDHAR',
    sector: 'Jammu & Kashmir',
    state: 'J&K',
    type: 'BOP',
    latitude: 32.4935,
    longitude: 74.7190
  },
  {
    id: 'BOP-KERAN',
    name: 'Keran Valley LoC Post',
    code: 'KERAN',
    sector: 'Jammu & Kashmir',
    state: 'J&K',
    type: 'BOP',
    latitude: 34.5210,
    longitude: 73.9850
  },
  {
    id: 'BOP-GUREZ',
    name: 'Gurez Valley Forward Post',
    code: 'GUREZ',
    sector: 'Jammu & Kashmir',
    state: 'J&K',
    type: 'BOP',
    latitude: 32.7035,
    longitude: 74.5840
  },

  // Ladakh LAC High Altitude Frontier
  {
    id: 'BOP-PANGONG',
    name: 'Pangong Tso North Post',
    code: 'PANGONG',
    sector: 'Ladakh LAC',
    state: 'Ladakh',
    type: 'BOP',
    latitude: 33.7595,
    longitude: 78.6674
  },
  {
    id: 'BOP-DBO',
    name: 'Daulat Beg Oldi (DBO) Advanced Post',
    code: 'DBO',
    sector: 'Ladakh LAC',
    state: 'Ladakh',
    type: 'BOP',
    latitude: 35.2536,
    longitude: 77.9254
  },
  {
    id: 'BOP-GALWAN',
    name: 'Galwan Valley High Post',
    code: 'GALWAN',
    sector: 'Ladakh LAC',
    state: 'Ladakh',
    type: 'BOP',
    latitude: 34.7578,
    longitude: 78.2241
  },
  {
    id: 'BOP-DEMCHOK',
    name: 'Demchok Border Post',
    code: 'DEMCHOK',
    sector: 'Ladakh LAC',
    state: 'Ladakh',
    type: 'BOP',
    latitude: 32.6958,
    longitude: 79.4625
  },
  {
    id: 'BOP-CHUSHUL',
    name: 'Chushul Bowl Outpost',
    code: 'CHUSHUL',
    sector: 'Ladakh LAC',
    state: 'Ladakh',
    type: 'BOP',
    latitude: 33.5852,
    longitude: 78.6534
  },
  {
    id: 'BOP-NYOMA',
    name: 'Nyoma Advanced Landing Post',
    code: 'NYOMA',
    sector: 'Ladakh LAC',
    state: 'Ladakh',
    type: 'BOP',
    latitude: 33.1982,
    longitude: 78.6510
  },

  // Eastern & North-East Frontier
  {
    id: 'BOP-PETRAPOLE',
    name: 'Petrapole Integrated Checkpost',
    code: 'PETRAPOLE',
    sector: 'Eastern Frontier',
    state: 'West Bengal',
    type: 'BOP',
    latitude: 23.0722,
    longitude: 88.8953
  },
  {
    id: 'BOP-HILI',
    name: 'Hili Border Checkpost',
    code: 'HILI',
    sector: 'Eastern Frontier',
    state: 'West Bengal',
    type: 'BOP',
    latitude: 25.2830,
    longitude: 89.0120
  },
  {
    id: 'BOP-CHANGRABANDHA',
    name: 'Changrabandha Checkpost',
    code: 'CHANGRABANDHA',
    sector: 'Eastern Frontier',
    state: 'West Bengal',
    type: 'BOP',
    latitude: 26.3810,
    longitude: 88.9240
  },
  {
    id: 'BOP-GHOJADANGA',
    name: 'Ghojadanga Border Checkpost',
    code: 'GHOJADANGA',
    sector: 'Eastern Frontier',
    state: 'West Bengal',
    type: 'BOP',
    latitude: 25.1213,
    longitude: 92.0827
  },
  {
    id: 'BOP-DAWKI',
    name: 'Dawki Border Checkpost',
    code: 'DAWKI',
    sector: 'Eastern Frontier',
    state: 'Meghalaya',
    type: 'BOP',
    latitude: 25.1873,
    longitude: 92.0197
  },
  {
    id: 'BOP-AKHAURA',
    name: 'Agartala-Akhaura Integrated Checkpost',
    code: 'AKHAURA',
    sector: 'Eastern Frontier',
    state: 'Tripura',
    type: 'BOP',
    latitude: 25.1513,
    longitude: 92.1247
  },
  {
    id: 'BOP-MOREH',
    name: 'Moreh Integrated Checkpost',
    code: 'MOREH',
    sector: 'Eastern Frontier',
    state: 'Manipur',
    type: 'BOP',
    latitude: 24.2483,
    longitude: 94.3056
  },
  {
    id: 'BOP-FULBARI',
    name: 'Fulbari Border Outpost (Siliguri)',
    code: 'FULBARI',
    sector: 'Eastern Frontier',
    state: 'West Bengal',
    type: 'BOP',
    latitude: 26.6520,
    longitude: 88.4120
  },
  {
    id: 'BOP-MAHADIPUR',
    name: 'Mahadipur Checkpost (Malda)',
    code: 'MAHADIPUR',
    sector: 'Eastern Frontier',
    state: 'West Bengal',
    type: 'BOP',
    latitude: 25.2233,
    longitude: 91.8907
  },
  {
    id: 'BOP-SRIMANTAPUR',
    name: 'Srimantapur Checkpost',
    code: 'SRIMANTAPUR',
    sector: 'Eastern Frontier',
    state: 'Tripura',
    type: 'BOP',
    latitude: 23.4520,
    longitude: 91.1850
  },

  // Base Tactical Outposts
  {
    id: 'BOP-ALPHA',
    name: 'BOP Alpha Outpost',
    code: 'ALPHA',
    sector: 'Northern Tactical Command',
    state: 'HQ Central',
    type: 'BOP',
    latitude: 28.7339,
    longitude: 77.2330
  },
  {
    id: 'BOP-BRAVO',
    name: 'BOP Bravo Outpost',
    code: 'BRAVO',
    sector: 'Northern Tactical Command',
    state: 'HQ Central',
    type: 'BOP',
    latitude: 28.5839,
    longitude: 77.1040
  },
  {
    id: 'BOP-CHARLIE',
    name: 'BOP Charlie Outpost',
    code: 'CHARLIE',
    sector: 'Northern Tactical Command',
    state: 'HQ Central',
    type: 'BOP',
    latitude: 28.6199,
    longitude: 77.3140
  },
  {
    id: 'BOP-DELTA',
    name: 'BOP Delta Outpost',
    code: 'DELTA',
    sector: 'Northern Tactical Command',
    state: 'HQ Central',
    type: 'BOP',
    latitude: 28.4699,
    longitude: 77.1040
  }
];

export function getSectorBadgeColor(sector: string): { bg: string; text: string; border: string } {
  if (sector.includes('Punjab')) {
    return { bg: 'bg-amber-950/60', text: 'text-amber-300', border: 'border-amber-500/30' };
  }
  if (sector.includes('Rajasthan')) {
    return { bg: 'bg-orange-950/60', text: 'text-orange-300', border: 'border-orange-500/30' };
  }
  if (sector.includes('Gujarat')) {
    return { bg: 'bg-cyan-950/60', text: 'text-cyan-300', border: 'border-cyan-500/30' };
  }
  if (sector.includes('Jammu')) {
    return { bg: 'bg-rose-950/60', text: 'text-rose-300', border: 'border-rose-500/30' };
  }
  if (sector.includes('Ladakh')) {
    return { bg: 'bg-sky-950/60', text: 'text-sky-300', border: 'border-sky-500/30' };
  }
  if (sector.includes('Eastern')) {
    return { bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-500/30' };
  }
  return { bg: 'bg-purple-950/60', text: 'text-purple-300', border: 'border-purple-500/30' };
}

export interface BorderSector {
  id: string;
  name: string;
  state: string;
}

export const BORDER_SECTORS: BorderSector[] = [
  { id: 'SITE-PUNJAB', name: 'Punjab Frontier', state: 'Punjab' },
  { id: 'SITE-RAJASTHAN', name: 'Rajasthan Desert Frontier', state: 'Rajasthan' },
  { id: 'SITE-GUJARAT', name: 'Gujarat & Rann of Kutch', state: 'Gujarat' },
  { id: 'SITE-JK', name: 'Jammu & Kashmir Sector', state: 'Jammu & Kashmir' },
  { id: 'SITE-LADAKH', name: 'Ladakh High Altitude', state: 'Ladakh' },
  { id: 'SITE-EASTERN', name: 'Eastern & North-East Frontier', state: 'West Bengal / Assam' },
  { id: 'SITE-BORDER-NORTH', name: 'Northern Tactical Command', state: 'Northern Border' },
];

const CUSTOM_CHECKPOSTS_KEY = 'ibvap_custom_checkposts';

export function getCustomCheckposts(): CheckpostItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CHECKPOSTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export function saveCustomCheckpost(item: CheckpostItem): void {
  try {
    const list = getCustomCheckposts();
    const existingIndex = list.findIndex(c => c.id.toUpperCase() === item.id.toUpperCase());
    if (existingIndex >= 0) {
      list[existingIndex] = item;
    } else {
      list.unshift(item);
    }
    localStorage.setItem(CUSTOM_CHECKPOSTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save custom checkpost:', e);
  }
}

export function getAllCheckposts(): CheckpostItem[] {
  const custom = getCustomCheckposts();
  const map = new Map<string, CheckpostItem>();
  // Default comprehensive list first
  COMPREHENSIVE_CHECKPOSTS.forEach(cp => map.set(cp.id.toUpperCase(), cp));
  // Custom checkposts override/extend
  custom.forEach(cp => map.set(cp.id.toUpperCase(), cp));
  return Array.from(map.values());
}

