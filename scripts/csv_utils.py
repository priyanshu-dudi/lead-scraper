"""
LeadForge Ultimate — CSV Merger & Deduplication Utility
Merge multiple CSV exports and remove duplicates
"""
import pandas as pd
import os
import sys
from datetime import datetime
import glob


def merge_csvs(input_dir: str = 'exports', output_file: str = None) -> str:
    """Merge all CSV files in exports directory"""
    csv_files = glob.glob(os.path.join(input_dir, '**/*.csv'), recursive=True)
    
    if not csv_files:
        print(f"No CSV files found in {input_dir}")
        return None

    print(f"Found {len(csv_files)} CSV files to merge")
    
    dfs = []
    for f in csv_files:
        try:
            df = pd.read_csv(f, encoding='utf-8', dtype=str)
            df['_source_file'] = os.path.basename(f)
            dfs.append(df)
            print(f"  📄 {os.path.basename(f)}: {len(df)} rows")
        except Exception as e:
            print(f"  ❌ Error reading {f}: {e}")

    if not dfs:
        return None

    combined = pd.concat(dfs, ignore_index=True)
    print(f"\n📊 Total rows before dedup: {len(combined)}")

    # Deduplicate
    combined = deduplicate(combined)
    print(f"📊 Total rows after dedup: {len(combined)}")

    # Save
    if not output_file:
        output_file = os.path.join(input_dir, f'merged_leads_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv')
    
    combined.drop(columns=['_source_file'], errors='ignore').to_csv(output_file, index=False, encoding='utf-8-sig')
    print(f"\n✅ Merged CSV saved: {output_file}")
    return output_file


def deduplicate(df: pd.DataFrame) -> pd.DataFrame:
    """Remove duplicate leads"""
    original_len = len(df)
    
    # Normalize phone numbers
    if 'Phone' in df.columns:
        df['_phone_norm'] = df['Phone'].str.replace(r'\D', '', regex=True).str.strip()
    if 'Email' in df.columns:
        df['_email_norm'] = df['Email'].str.lower().str.strip()
    if 'Website' in df.columns:
        df['_domain_norm'] = df['Website'].str.replace(r'^https?://(www\.)?', '', regex=True).str.rstrip('/')

    # Drop duplicates by email first
    if '_email_norm' in df.columns:
        df = df.drop_duplicates(subset=['_email_norm'], keep='first')
    
    # Then by phone
    if '_phone_norm' in df.columns:
        df = df[df['_phone_norm'].str.len() < 7 | df.duplicated(subset=['_phone_norm'], keep='first') == False]
        df = df.drop_duplicates(subset=['_phone_norm'], keep='first')

    # Then by domain
    if '_domain_norm' in df.columns:
        df = df.drop_duplicates(subset=['_domain_norm'], keep='first')

    # Clean up temp columns
    temp_cols = [c for c in df.columns if c.startswith('_')]
    df = df.drop(columns=temp_cols, errors='ignore')

    removed = original_len - len(df)
    print(f"  🔄 Removed {removed} duplicates")
    return df


def filter_leads(input_file: str, niche: str = None, city: str = None, 
                  min_score: int = 0, output_file: str = None) -> str:
    """Filter leads from a CSV file"""
    df = pd.read_csv(input_file, dtype=str)
    
    if niche:
        df = df[df['Niche'].str.contains(niche, case=False, na=False)]
    if city:
        df = df[df['City'].str.contains(city, case=False, na=False)]
    if min_score > 0 and 'Lead Score' in df.columns:
        df = df[pd.to_numeric(df['Lead Score'], errors='coerce').fillna(0) >= min_score]

    if not output_file:
        output_file = input_file.replace('.csv', f'_filtered_{niche or "all"}_{datetime.now().strftime("%H%M%S")}.csv')
    
    df.to_csv(output_file, index=False, encoding='utf-8-sig')
    print(f"✅ Filtered {len(df)} leads → {output_file}")
    return output_file


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='LeadForge CSV Utility')
    parser.add_argument('action', choices=['merge', 'dedupe', 'filter'])
    parser.add_argument('--input', default='exports', help='Input file or directory')
    parser.add_argument('--output', help='Output file path')
    parser.add_argument('--niche', help='Filter by niche')
    parser.add_argument('--city', help='Filter by city')
    parser.add_argument('--min-score', type=int, default=0, help='Minimum lead score')
    
    args = parser.parse_args()
    
    if args.action == 'merge':
        merge_csvs(args.input, args.output)
    elif args.action == 'filter':
        filter_leads(args.input, args.niche, args.city, args.min_score, args.output)
