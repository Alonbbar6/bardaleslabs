// Miami-Dade car directory: page copy and pick-lists. The listings themselves live in D1 (admin → Cars).
export const carsCopy = {
  eyebrow: "Miami-Dade · Cars for sale",
  title: "Cars for sale around Miami-Dade.",
  lede: "We photograph cars with for-sale signs across the county and list them here, so you can shop them in one place. Call or text the seller straight from the listing.",
  sellTitle: "Selling a car in Miami-Dade?",
  sellBody: "Send us a few photos, the price and your number, and we'll add it to the directory.",
  disclaimer: "BardalesLabs photographs and lists cars we find for sale. We're not the seller or a dealer and can't vouch for any vehicle; details come from the seller's sign and may be out of date.",
  steps: [
    ["Spotted", "We drive Miami-Dade and photograph cars with a for-sale sign in the window."],
    ["Listed", "Price, mileage and the seller's number from the sign go up here, usually the same day."],
    ["You call", "Contact the seller directly. No middleman, no fees from us."],
  ],
};

export const MAKES = ["Acura", "Alfa Romeo", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Fiat", "Ford", "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia", "Land Rover", "Lexus", "Lincoln", "Maserati", "Mazda", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan", "Porsche", "Ram", "Subaru", "Tesla", "Toyota", "Volkswagen", "Volvo"];
export const BODIES = ["Sedan", "SUV", "Truck", "Coupe", "Hatchback", "Convertible", "Minivan", "Van", "Wagon", "Motorcycle", "Other"];
export const TRANSMISSIONS = ["Automatic", "Manual"];
export const FUELS = ["Gas", "Hybrid", "Electric", "Diesel"];
export const TITLES = ["Clean", "Rebuilt", "Salvage"];
export const SELLERS = ["Private", "Dealer"];
export const CAR_STATUSES = [["draft", "Draft (hidden)"], ["available", "Available"], ["pending", "Sale pending"], ["sold", "Sold"]];

// Cities, towns and neighborhoods people actually say when they describe where a car is.
export const AREAS = ["Allapattah", "Aventura", "Bal Harbour", "Bay Harbor Islands", "Biscayne Park", "Brickell", "Brownsville", "Coconut Grove", "Coral Gables", "Coral Terrace", "Country Club", "Country Walk", "Cutler Bay", "Doral", "Downtown Miami", "Edgewater", "El Portal", "Florida City", "Fontainebleau", "Gladeview", "Golden Glades", "Goulds", "Hialeah", "Hialeah Gardens", "Homestead", "Kendale Lakes", "Kendall", "Kendall West", "Key Biscayne", "Leisure City", "Liberty City", "Little Haiti", "Little Havana", "Medley", "Miami", "Miami Beach", "Miami Gardens", "Miami Lakes", "Miami Shores", "Miami Springs", "Naranja", "North Bay Village", "North Miami", "North Miami Beach", "Olympia Heights", "Opa-locka", "Overtown", "Palmetto Bay", "Pinecrest", "Princeton", "Redland", "Richmond Heights", "South Miami", "Sunny Isles Beach", "Surfside", "Sweetwater", "Tamiami", "The Hammocks", "Three Lakes", "Virginia Gardens", "West Miami", "Westchester", "Westwood Lakes", "Wynwood"];

export const PRICE_CAPS = [5000, 10000, 15000, 20000, 30000, 50000];
export const CAR_SORTS = [["new", "Newest listings"], ["price", "Price: low to high"], ["price-desc", "Price: high to low"], ["miles", "Lowest mileage"], ["year", "Newest model year"]];
