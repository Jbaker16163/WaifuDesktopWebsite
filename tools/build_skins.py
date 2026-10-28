"""Build data/skins.json (the catalog used by collection.html) from the game's inventory.json.

Usage:
    python tools/build_skins.py [path/to/inventory.json]

Re-run whenever items are added or renamed, then commit data/skins.json.
"""
import json
import os
import sys

DEFAULT_SOURCE = r"H:\InventoryJson\inventory.json"
IMAGE_URL = "https://jbaker16163.github.io/WaifuImages/Images/small/{base}.png?v=2"

# Same labels the Steamworks itemdef export uses for the "Types" tag.
TYPE_LABELS = {
    "Extras": "Accessories",
    "Bodies": "Skin",
    "Shirts": "Shirts",
    "Hair": "Hair",
    "Faces": "Faces",
    "Pets": "Pets",
}
RARITY_ORDER = ["Basic", "Common", "Uncommon", "Rare", "Epic", "Legendary"]


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SOURCE
    with open(source, encoding="utf-8") as f:
        inventory = json.load(f)

    skins = []
    for category, items in inventory.items():
        label = TYPE_LABELS.get(category)
        if label is None:  # Non-Equippable (shards) aren't collectible skins
            continue
        for it in items:
            base = os.path.splitext(os.path.basename(it["path"]))[0]
            skins.append({
                "id": it["item_id"],
                "name": it["Name"],
                "desc": it["Desc"],
                "type": label,
                "rarity": it.get("RarityTeir", ""),
                "img": IMAGE_URL.format(base=base),
            })

    skins.sort(key=lambda s: (list(TYPE_LABELS.values()).index(s["type"]),
                              -RARITY_ORDER.index(s["rarity"]) if s["rarity"] in RARITY_ORDER else 0,
                              s["name"]))

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "skins.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"appid": 3702960, "types": list(TYPE_LABELS.values()),
                   "rarities": RARITY_ORDER, "skins": skins}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(skins)} skins to {os.path.normpath(out)}")


if __name__ == "__main__":
    main()
