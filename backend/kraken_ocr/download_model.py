from kraken.lib.models import download_model

# Nom du modèle manuscrit français moderne (mixte)
model_name = "fr-2023-mixed-handwriting"

# Téléchargement du modèle dans le répertoire local ~/.local/share/kraken/
download_model(model_name)
print(f"✅ Modèle {model_name} téléchargé avec succès.")
