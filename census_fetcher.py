import sys
import pandas as pd
import requests
import numpy as np
import os

def get_census_data(table_id, state_fips):
    API_KEY = os.getenv("CENSUS_API_KEY")
    
    base_url = "https://api.census.gov/data/2022/acs/acs5"
    
    variables_url = f"{base_url}/variables.json"
    response = requests.get(variables_url)
    variables_data = response.json()
    
    table_vars = [var for var in variables_data['variables'].keys() 
                 if var.startswith(table_id) and var.split('_')[0] == table_id and not var.endswith('EA')]
    
    variables = ','.join(table_vars)
    query_url = f"{base_url}?get={variables},NAME&for=tract:*&in=state:{state_fips}&key={API_KEY}"

    response = requests.get(query_url)
    data = response.json()
    
    df = pd.DataFrame(data[1:], columns=data[0])
    
    df['GEOID'] = df['state'] + df['tract']
    
    keep_cols = ['GEOID'] + table_vars
    df = df[keep_cols]
    
    for col in table_vars:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return df

def state_to_fips(state):
    fips_codes = {
        'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09',
        'DE': '10', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
        'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25',
        'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32',
        'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39',
        'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46', 'TN': '47',
        'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55',
        'WY': '56', 'DC': '11'
    }
    return fips_codes.get(state.upper())

def fetch_and_save(table_id, state, path="."):
    df = get_census_data(table_id, state_fips)
    output_file = f"{path}/{table_id}_{state}.csv"
    df.to_csv(output_file, index=False)
    print(f"Data saved to {output_file}")

def main():
    if len(sys.argv) != 3:
        print("Usage: python census_fetcher.py TABLE_ID STATE")
        print("Example: python census_fetcher.py B01001 VA")
        sys.exit(1)
        
    table_id = sys.argv[1]
    state = sys.argv[2]
    
    state_fips = state_to_fips(state)
    if not state_fips:
        print(f"Error: Invalid state abbreviation '{state}'")
        sys.exit(1)
    
    try:
        download(table_id, state)
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
