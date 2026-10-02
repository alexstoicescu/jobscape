// Local snapshot, 2026-10-02. Sources and definitions: HIRING-REGIONS.md.
export const hiringRegions = ['Global', 'EU', 'EMEA', 'APAC', 'US'] as const;
export type HiringRegion = typeof hiringRegions[number];
export type Regional = Exclude<HiringRegion, 'Global'>;
const list = (value: string) => value.split('|');
export const euCountries = list('Austria|Belgium|Bulgaria|Croatia|Cyprus|Czechia|Denmark|Estonia|Finland|France|Germany|Greece|Hungary|Ireland|Italy|Latvia|Lithuania|Luxembourg|Malta|Netherlands|Poland|Portugal|Romania|Slovakia|Slovenia|Spain|Sweden');
export const emeaEurope = list('Armenia|Azerbaijan|Belarus|Bulgaria|Czechia|Georgia|Hungary|Kazakhstan|Kyrgyzstan|Moldova|Poland|Romania|Russia|Slovakia|Tajikistan|Turkmenistan|Ukraine|Uzbekistan|Denmark|Estonia|Finland|Iceland|Latvia|Lithuania|Norway|Sweden|Albania|Andorra|Bosnia and Herzegovina|Croatia|Greece|Italy|Kosovo|Malta|Monaco|Montenegro|North Macedonia|Portugal|San Marino|Serbia|Slovenia|Spain|Turkey|Vatican City|Austria|Belgium|France|Germany|Ireland|Liechtenstein|Luxembourg|Netherlands|Switzerland|United Kingdom');
const mena = list('Afghanistan|Algeria|Bahrain|Cyprus|Egypt|Iran|Iraq|Israel|Jordan|Kuwait|Lebanon|Libya|Morocco|Oman|Palestine|Qatar|Saudi Arabia|Sudan|Syria|Tunisia|United Arab Emirates|Yemen');
const africa = list('Burundi|Djibouti|Eritrea|Ethiopia|Kenya|Rwanda|Somalia|South Sudan|Tanzania|Uganda|Cameroon|Central African Republic|Chad|Democratic Republic of the Congo|Republic of the Congo|Equatorial Guinea|Gabon|São Tomé and Príncipe|Angola|Botswana|Comoros|Eswatini|Lesotho|Madagascar|Malawi|Mauritius|Mozambique|Namibia|Seychelles|South Africa|Zambia|Zimbabwe|Benin|Burkina Faso|Cape Verde|Gambia|Ghana|Guinea|Guinea-Bissau|Ivory Coast|Liberia|Mali|Mauritania|Niger|Nigeria|Saint Helena, Ascension and Tristan da Cunha|Senegal|Sierra Leone|Togo');
export const emeaCountries = [...new Set([...emeaEurope, ...mena, ...africa])];
export const apacCountries = list('China|Hong Kong|Japan|North Korea|South Korea|Taiwan|Macau|Mongolia|Afghanistan|Bangladesh|Bhutan|India|Maldives|Nepal|Pakistan|Sri Lanka|Brunei|Cambodia|Indonesia|Laos|Malaysia|Myanmar|Philippines|Singapore|Thailand|Timor-Leste|Vietnam|American Samoa|Australia|Cook Islands|Fiji|French Polynesia|Guam|Kiribati|Marshall Islands|Micronesia|Nauru|New Caledonia|New Zealand|Niue|Northern Mariana Islands|Palau|Papua New Guinea|Samoa|Solomon Islands|Tonga|Tuvalu|Vanuatu');
export const regionCountries: Record<Regional, string[]> = {EU: euCountries, EMEA: emeaCountries, APAC: apacCountries, US: ['United States']};
export const countryNames = [...new Set([...emeaCountries, ...apacCountries, 'United States', 'Canada', 'Brazil', 'Mexico', 'Argentina'])];
// Existing country/city aliases resolve through normalizePlace; these names
// connect its ISO output to the complete, explicitly sourced regional lists.
export const existingCountryNames: Record<string, string> = {
  DE:'Germany', GB:'United Kingdom', US:'United States', CA:'Canada', FR:'France', ES:'Spain', NL:'Netherlands', IE:'Ireland',
  CH:'Switzerland', AT:'Austria', PL:'Poland', PT:'Portugal', IT:'Italy', SE:'Sweden', DK:'Denmark', NO:'Norway', FI:'Finland',
  BE:'Belgium', CZ:'Czechia', RO:'Romania', AU:'Australia', NZ:'New Zealand', IN:'India', SG:'Singapore', JP:'Japan', BR:'Brazil', MX:'Mexico', AR:'Argentina'
};
export const extraCountryAliases: Record<string, string[]> = {
  'United States':['united states of america','u s','u s a','usa'], 'Czechia':['czech republic'], 'Turkey':['turkiye'],
  'Ivory Coast':['cote d ivoire'], 'Cape Verde':['cabo verde'], 'Eswatini':['swaziland'], 'Myanmar':['burma'],
  'Macau':['macao'], 'Timor-Leste':['east timor'], 'Micronesia':['federated states of micronesia','micronesia federated states of'],
  'Democratic Republic of the Congo':['dr congo','drc','congo kinshasa'], 'Republic of the Congo':['congo brazzaville'],
  'Saint Helena, Ascension and Tristan da Cunha':['saint helena','ascension island','tristan da cunha'], 'Gambia':['the gambia']
};
