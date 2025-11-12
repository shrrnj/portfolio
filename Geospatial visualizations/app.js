console.clear();
console.log("Step 2: Mapbox base map + bike lanes setup 🗺️🚲");

// 1) Setting Mapbox token
mapboxgl.accessToken = "pk.eyJ1Ijoic2hycm5qIiwiYSI6ImNtaHZqOXdkOTBiNjkyam9sZmtvN280czAifQ.bJJBb2dNCVa0MoH3imCdQw";

// 2) Creating the map
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v11",
  center: [-71.0589, 42.3601], // Boston
  zoom: 11
});


map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
map.addControl(new mapboxgl.FullscreenControl(), "top-right");

// 3) Waiting for map to load, then adding the bike lanes source + layer
map.on("load", async () => {
  console.log("Map loaded ✅");

  const dataURL = "https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson";

  map.addSource("boston_route", {
    type: "geojson",
    data: dataURL
  });

  map.addLayer({
    id: "boston-bike-lanes",
    type: "line",
    source: "boston_route",
    paint: {
      "line-color": "#0074D9",
      "line-width": 2,
      "line-opacity": 0.9
    }
  });

  console.log("Bike lanes added 🚲");
});