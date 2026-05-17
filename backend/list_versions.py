import requests

def list_genesis_versions():
    url = "https://www.sefaria.org/api/texts/versions/Genesis"
    versions = requests.get(url).json()
    
    print(f"{'Language':<10} | {'Version Title'}")
    print("-" * 50)
    for v in versions:
        print(f"{v['language']:<10} | {v['versionTitle']}")

if __name__ == "__main__":
    list_genesis_versions()