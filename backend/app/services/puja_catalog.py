"""Demo temple & puja catalog, seeded idempotently into the DB on startup.

Real temples, standard pujas, per-devotee prices in the ₹100–₹450 band. Prices
are the source of truth for the amount charged — the client never sends a price.
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.models import Puja, Temple

# image_url values reuse the app's existing Cloudinary account style; swap for
# real temple photos when available.
_CATALOG: list[dict] = [
    {
        "slug": "kashi-vishwanath",
        "name": "Kashi Vishwanath Temple",
        "deity": "Lord Shiva",
        "city": "Varanasi",
        "state": "Uttar Pradesh",
        "about": "One of the twelve Jyotirlingas, on the western bank of the Ganga. "
        "The spiritual heart of Kashi.",
        "sort_order": 1,
        "pujas": [
            {
                "slug": "mangala-aarti",
                "name": "Mangala Aarti Sankalp",
                "description": "Your name and sankalp offered at the pre-dawn Mangala Aarti.",
                "benefits": "Auspicious beginnings, removal of obstacles.",
                "price_per_person_paise": 15100,
                "daily_capacity": 108,
                "duration_note": "Offered at dawn",
            },
            {
                "slug": "rudrabhishek",
                "name": "Rudrabhishek",
                "description": "Abhishekam of the Jyotirlinga with milk, honey, and Ganga jal in your name.",
                "benefits": "Health, longevity, relief from graha dosha.",
                "price_per_person_paise": 25100,
                "daily_capacity": 54,
                "duration_note": "~45 min",
            },
            {
                "slug": "maha-mrityunjaya-homa",
                "name": "Maha Mrityunjaya Homa",
                "description": "1008-count Maha Mrityunjaya mantra homa performed by temple priests.",
                "benefits": "Protection, healing, freedom from fear.",
                "price_per_person_paise": 45000,
                "daily_capacity": 27,
                "duration_note": "~90 min",
            },
        ],
    },
    {
        "slug": "somnath",
        "name": "Somnath Temple",
        "deity": "Somnath Mahadev",
        "city": "Prabhas Patan",
        "state": "Gujarat",
        "about": "The first among the twelve Jyotirlingas, on the Arabian Sea coast of Saurashtra.",
        "sort_order": 2,
        "pujas": [
            {
                "slug": "abhishek-puja",
                "name": "Abhishek Puja",
                "description": "Sponsored abhishek of Somnath Mahadev with your family's names.",
                "benefits": "Peace, prosperity, family harmony.",
                "price_per_person_paise": 20100,
                "daily_capacity": 81,
                "duration_note": "~30 min",
            },
            {
                "slug": "sandhya-aarti-sankalp",
                "name": "Sandhya Aarti Sankalp",
                "description": "Your sankalp taken at the evening Sandhya Aarti before the sea-facing sanctum.",
                "benefits": "Gratitude, closure of a difficult chapter.",
                "price_per_person_paise": 11100,
                "daily_capacity": 108,
                "duration_note": "Offered at dusk",
            },
        ],
    },
    {
        "slug": "mahakaleshwar",
        "name": "Mahakaleshwar Temple",
        "deity": "Mahakal (Shiva)",
        "city": "Ujjain",
        "state": "Madhya Pradesh",
        "about": "The Jyotirlinga of Ujjain, famed for the Bhasma Aarti offered with sacred ash at dawn.",
        "sort_order": 3,
        "pujas": [
            {
                "slug": "bhasma-aarti-sankalp",
                "name": "Bhasma Aarti Sankalp",
                "description": "Your name entered in the sankalp for the pre-dawn Bhasma Aarti.",
                "benefits": "Transformation, release of the old.",
                "price_per_person_paise": 18100,
                "daily_capacity": 54,
                "duration_note": "Offered ~4 AM",
            },
            {
                "slug": "kaal-sarp-dosh-nivaran",
                "name": "Kaal Sarp Dosh Nivaran Puja",
                "description": "Traditional Kaal Sarp shanti performed on your behalf at Mahakal.",
                "benefits": "Relief from Kaal Sarp yoga, smoother progress.",
                "price_per_person_paise": 40100,
                "daily_capacity": 27,
                "duration_note": "~2 hrs",
            },
        ],
    },
    {
        "slug": "tirumala-tirupati",
        "name": "Tirumala Tirupati (Sri Venkateswara)",
        "deity": "Lord Venkateswara",
        "city": "Tirumala",
        "state": "Andhra Pradesh",
        "about": "The hill abode of Sri Venkateswara, among the most visited temples in the world.",
        "sort_order": 4,
        "pujas": [
            {
                "slug": "archana-sankalp",
                "name": "Archana Sankalp",
                "description": "Archana in your name and nakshatra at the sanctum of Sri Venkateswara.",
                "benefits": "Fulfilment of a heartfelt wish, prosperity.",
                "price_per_person_paise": 10000,
                "daily_capacity": 216,
                "duration_note": "Same-day",
            },
            {
                "slug": "kalyanotsavam",
                "name": "Kalyanotsavam Sponsorship",
                "description": "Sponsored participation in the celestial wedding ceremony of the Lord and Goddesses.",
                "benefits": "Marital harmony, blessings for a new union.",
                "price_per_person_paise": 35000,
                "daily_capacity": 40,
                "duration_note": "~1 hr",
            },
        ],
    },
    {
        "slug": "siddhivinayak",
        "name": "Siddhivinayak Temple",
        "deity": "Lord Ganesha",
        "city": "Mumbai",
        "state": "Maharashtra",
        "about": "The beloved Ganesha temple of Prabhadevi, Mumbai — first stop for every new beginning.",
        "sort_order": 5,
        "pujas": [
            {
                "slug": "ganapati-archana",
                "name": "Ganapati Archana",
                "description": "Archana with durva and modak offered in your name.",
                "benefits": "Removal of obstacles, success in a new venture.",
                "price_per_person_paise": 10100,
                "daily_capacity": 216,
                "duration_note": "Same-day",
            },
            {
                "slug": "ganapati-homa",
                "name": "Ganapati Homa",
                "description": "A full Ganapati homa performed by temple priests for your sankalp.",
                "benefits": "Clearing the path before an important undertaking.",
                "price_per_person_paise": 30100,
                "daily_capacity": 36,
                "duration_note": "~75 min",
            },
        ],
    },
    {
        "slug": "vaishno-devi",
        "name": "Vaishno Devi (Mata Rani)",
        "deity": "Mata Vaishno Devi",
        "city": "Katra",
        "state": "Jammu & Kashmir",
        "about": "The cave shrine of the Mother Goddess in the Trikuta hills, reached by the climb from Katra.",
        "sort_order": 6,
        "pujas": [
            {
                "slug": "atka-aarti-sankalp",
                "name": "Atka Aarti Sankalp",
                "description": "Your name in the sankalp for the morning and evening Atka Aarti at the Bhawan.",
                "benefits": "The Mother's protection over your family.",
                "price_per_person_paise": 14100,
                "daily_capacity": 108,
                "duration_note": "Morning / evening",
            },
            {
                "slug": "navratri-chandi-path",
                "name": "Navratri Chandi Path Sponsorship",
                "description": "Sponsored Durga Saptashati (Chandi) path recited on your behalf.",
                "benefits": "Strength, courage, victory over a long struggle.",
                "price_per_person_paise": 40100,
                "daily_capacity": 27,
                "duration_note": "~3 hrs",
            },
        ],
    },
]


def seed_catalog(session: Session) -> None:
    """Insert temples/pujas if the tables are empty. Safe to call on every boot."""
    existing = session.exec(select(Temple)).first()
    if existing is not None:
        return

    for t in _CATALOG:
        temple = Temple(
            slug=t["slug"],
            name=t["name"],
            deity=t["deity"],
            city=t["city"],
            state=t["state"],
            image_url=t.get("image_url", ""),
            about=t.get("about", ""),
            sort_order=t.get("sort_order", 0),
        )
        session.add(temple)
        session.flush()  # get temple.id
        for i, p in enumerate(t["pujas"]):
            session.add(
                Puja(
                    temple_id=temple.id,
                    slug=p["slug"],
                    name=p["name"],
                    description=p.get("description", ""),
                    benefits=p.get("benefits", ""),
                    price_per_person_paise=p["price_per_person_paise"],
                    daily_capacity=p.get("daily_capacity", 108),
                    duration_note=p.get("duration_note", ""),
                    sort_order=i,
                )
            )
    session.commit()
