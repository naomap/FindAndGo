
var FindAndGo = L.Class.extend({
    
    GRAPHHOPPER_BASE_URL : "https://graphhopper.com/api/1/route?",
    PHOTON_GEOCODING_URL : "//api-adresse.data.gouv.fr/search/?",
    PHOTON_REVERSE_GEOCODING_URL : "//api-adresse.data.gouv.fr/reverse/?",
    
    options: {
        configFile: "config.json",
        locateZoom : 16, // Min zoom level when locating an address
        overpassBaseUrl: "http://overpass-api.de/api/",
        graphhopperApiKey : "Get your API key on https://graphhopper.com/"
    },
    
    initialize : function(divId, map, options) {
    
        L.setOptions(this, options);
        this._loadPanel(divId);
        this._setupMap(map);
    },

    _loadPanel : function(divId) {
        var _this = this;
        var request = new XMLHttpRequest();
        request.open("GET", "FindAndGo.html", true);
        request.onload = function() {
            L.DomUtil.get(divId).innerHTML = this.responseText;
            _this._initStep1(_this.options);
            _this._initStep2(_this.options);
            _this._initStep3(_this.options);
        };
        request.send();
    },
    
    _setupMap : function(map) {
        this.map = map;  // Must be a Leaflet map
        this.map.doubleClickZoom.disable();
        this.map.on("dblclick", L.bind(this.setLocation, this));

        this.overlays = {};
    },
    
    stepReady : function(stepId) {
        L.DomUtil.removeClass(L.DomUtil.get(stepId), "FaG-Disable");
    },
    
    // --------------------------------------------------
    // STEP 1 : LOCATE USER WITH GEOCODING OR GEOLOCATION
    // --------------------------------------------------
    
    _initStep1 : function(options) {
        this._initPhotonSearch();
        this._initGeolocation();
        this._initLatLonFields();
    },
    
    _initLatLonFields : function() {
            
        var action = L.bind(this.latlonChanged, this);
        L.DomEvent.on(L.DomUtil.get("FaG-lat"), "change", action);
        L.DomEvent.on(L.DomUtil.get("FaG-lon"), "change", action);
    },
    
    latlonChanged : function() {
        var lat = L.DomUtil.get("FaG-lat").value;
        var lon = L.DomUtil.get("FaG-lon").value;
        if (lat && lon) {
            var newPos = L.latLng(lat, lon);
            this.setLocation(newPos);
        }
    },
    
    _initGeolocation : function() {
        var _this = this;
        
        var locateField = L.DomUtil.get("FaG-locate");
        L.DomEvent.on(locateField, "click", function() {
            _this.map.locate({
                setView: false,
                maxZoom: _this.options.locateZoom
            });
        });
        
        this.map.on("locationfound", L.bind(this.setLocation, this));
    },
    
    _initPhotonSearch : function() {
    
        var _this = this;
        
        var inputAddress = L.DomUtil.get("FaG-photon");
        new L.PhotonSearch(this.map, inputAddress, {
            url: this.PHOTON_GEOCODING_URL,
            placeholder: 'Adresse',
            noResultLabel: 'Aucun résultat',
            feedbackEmail: null,
            minChar: 3,
            onSelected: function(geoJson) {
                var coord = geoJson.geometry.coordinates;
                var latLng = L.latLng(coord[1], coord[0]);
                var address = geoJson.properties.label;
                _this.setLocation(latLng, address);
            }
        });
    
        this.reverseGeocoder = new L.PhotonReverse({
            url: this.PHOTON_REVERSE_GEOCODING_URL, 
            handleResults: L.bind(this.addressFound, this)
        });
    },

    findAddress : function(latLng) {
        this.reverseGeocoder.doReverse(latLng);
    },
    
    addressFound : function(geoJsonData) {
        // Callback for reverse geocoding
        if (geoJsonData.features.length === 0) {
            this.showAddress("Aucune adresse trouvée à cet endroit");
        } else {
            var address = geoJsonData.features[0].properties.label;
            this.showAddress(address);
        }
    },
    
    setLocation: function(location, address) {
        
        // location : LatLng, MouseEvent, LocationEvent or DragEndEvent
        var latLng;
        if (location instanceof L.LatLng) {
            latLng = location;
        } else if (location.target instanceof L.Marker) {
            latLng = location.target.getLatLng();
        } else {
            latLng = location.latlng;
        }
        
        this.location = latLng;        
        this.showMarker(latLng);
        this.showLatLng(latLng);
        
        if (address) {
            this.showAddress(address);
        } else {
            this.findAddress(latLng);
        }
        this.stepReady("FaG-step2");
    },
    
    showMarker : function(latlng) {
    
        // Create a draggable marker or move it
        var setView;
        if (! this.marker) {
            var icon = L.icon({
                iconUrl: "img/moving_marker.png",
                iconSize: [28,40],
                iconAnchor: [13,38]
            });
            this.marker = L.marker(latlng, {
                icon: icon,
                title: "Déplacez-moi pour affiner ma position",
                draggable: true,
                zIndexOffset: 1000
            });
            this.map.addLayer(this.marker);
            this.marker.on('dragend', L.bind(this.setLocation, this));
            
            setView = true;
        } else {
            this.marker.setLatLng(latlng);
            
            // Set the view only if the marker gets near the border
            var pt = this.map.latLngToContainerPoint(latlng);
            var containerSize = this.map.getSize();
            var width = containerSize.x,
                height = containerSize.y;
            setView = (pt.x < width  * 0.25 || pt.x > width  * 0.75 ||
                       pt.y < height * 0.25 || pt.y > height * 0.75);
        }
        
        if (setView) {
            // Pan the map, possibly zoom in but don't zoom out
            var zoom = Math.max(this.map.getZoom(), this.options.locateZoom);
            this.map.setView(latlng, zoom);
        }
    },
    
    showLatLng : function(latLng) {
        L.DomUtil.get("FaG-lat").value = L.Util.formatNum(latLng.lat, 5);
        L.DomUtil.get("FaG-lon").value = L.Util.formatNum(latLng.lng, 5);
    },
    
    showAddress : function(address) {
        var outputAddress = L.DomUtil.get("FaG-address");
        outputAddress.innerHTML = address;
    },

    // -----------------------------------------------
    // STEP 2 : GETTING OSM DATA WITH THE OVERPASS API
    // -----------------------------------------------
    
    _initStep2 : function(options) {
        this._loadSearchTypes(options.configFile);
        this._initOverpassSearch();
    },

    _loadSearchTypes : function(configFile) {
        var _this = this;
        var request = new XMLHttpRequest();  // Not supported on IE < 10
        request.open("GET", configFile, true);
        request.onload = function() {
            if (this.status === 200) {
                var response = JSON.parse(this.response);
                _this._initTypeSelector(response.dataTypes);
                _this._initDistances(response.distances);
            }
        };
        request.send();
    },
    
    _initDistances: function(distances) {
        var distanceItem = L.DomUtil.get("FaG-distanceSelector");
        for (var i = 0 ; i < distances.length ; i++) {
            var dist = distances[i]; 
            var optionItem = new Option(dist + " m", dist);
            distanceItem.options[i] = optionItem;
        }
    },
    
    _initTypeSelector: function(searchTypes) {
        this.searchTypes = searchTypes;
        var selectItem = L.DomUtil.get("FaG-typeSelector");
        for (var i = 0 ; i < this.searchTypes.length ; i++) {
            var choice = this.searchTypes[i];
            var optionItem = new Option(choice.name, choice.value);
            selectItem.options[i] = optionItem;
        }
    },
    
    _initOverpassSearch: function() {
        var elt = L.DomUtil.get("FaG-query"),
            action = L.bind(this.queryData, this);
        L.DomEvent.on(elt, "click", action);
    },
    
    queryData: function() {

        var selectItem = L.DomUtil.get("FaG-typeSelector");
        //var choice = selectItem.options[selectItem.selectedIndex];
        // NOTE: this assumes HTML and JSON in same order
        var dataType = this.searchTypes[selectItem.selectedIndex];
        
        var distanceItem = L.DomUtil.get("FaG-distanceSelector"),
            distanceOption = distanceItem.options[distanceItem.selectedIndex],
            distance = distanceOption.text,
            radius = parseFloat(distanceOption.value);
        
        var _this = this;
        var url = this._buildOverpassRequest(dataType, radius);
        var request = new XMLHttpRequest();  // Not supported on IE < 10
        request.open("GET", url, true);
        request.onload = function() {
            if (this.status === 200) {
                var response = JSON.parse(this.response);
                _this._displayOverpassResponse(response, dataType, distance);
            } else {
                this.feedbackSearch("Une erreur s'est produite lors de la recherche !");
            }
        };
        request.send();
        this.feedbackSearch("Recherche en cours ...");
    },
    
    _buildOverpassRequest : function(typeInfo, radius) {

        var ll = this.marker.getLatLng();
        var around = '(around:' + Math.round(radius) + ',' + ll.lat.toFixed(5) + ',' + ll.lng.toFixed(5) + ')';
        var filter = '["' + typeInfo.tag + (typeInfo.value ? '"="' + typeInfo.value : "") + '"]';
        var query = 'node' + around + filter + ';out;';
        
        return this.options.overpassBaseUrl + 'interpreter?data=[out:json];' + query;
    },
    
    _displayOverpassResponse : function(data, layerInfo, distance) {
        
        var numItems = data.elements.length;
        if (numItems > 0) {
            var str = (numItems === 1) ? " élément" : " éléments";
            this.feedbackSearch("Trouvé " + numItems + str + " dans OpenStreetMap");
            var layer = this.buildLayer(data.elements, layerInfo);
            this.addLayer(layer, layerInfo);
            this.stepReady("FaG-step3");
        } else {
            this.feedbackSearch("Aucun élément trouvé dans un rayon de " + distance);
        }
    },
    
    feedbackSearch : function(message) {
        var feedbackItem = L.DomUtil.get("FaG-feedbackPOI");
        feedbackItem.innerHTML = message;
    },
    
    buildLayer: function(osmElements, layerInfo) {

        var layer = L.featureGroup();
        var icon = this.getIcon(layerInfo);
        
        for (var i = 0 ; i < osmElements.length ; i++) {
            var elt = osmElements[i];
            if (elt.type === "node") {
                var latLng = L.latLng(elt.lat, elt.lon);
                var options = {
                    icon: icon,
                    layerName : layerInfo.name
                };
                if (layerInfo.title) {
                    try {
                        options.title = L.Util.template(layerInfo.title, elt.tags);
                    } catch (exception) {
                        // Ignore missing tags
                    }
                }
                var marker = new L.marker(latLng, options);
                marker.on("click", L.bind(this.setDestination, this, marker));
                layer.addLayer(marker);
            }
        }
        return layer;
    },

    addLayer: function(layer, layerInfo) {
        
        var layerControl = this.options.layerControl;
        var overlayName = layerInfo.key;
        
        // Remove the layer of this category if already there
        var currentOverlay = this.overlays[overlayName];
        if (currentOverlay) {
            this.map.removeLayer(currentOverlay);
            if (layerControl) layerControl.removeLayer(currentOverlay);
            delete this.overlays[overlayName];
        }
        
        // Add the new layer on the map and on the layer control if any
        this.map.addLayer(layer);
        var bounds = layer.getBounds().extend(this.marker.getLatLng()).pad(0.1);
        this.map.fitBounds(bounds);
        this.overlays[overlayName] = layer;
        if (layerControl) {
            layerControl.addOverlay(layer, layerInfo.name);
        }
    },
    
    getIcon : function(layerInfo) {
        if (! this.icons) this.icons = {};
        
        if (! this.icons[layerInfo.key]) {
            this.icons[layerInfo.key] = L.icon({
                iconUrl : layerInfo.icon,
                iconSize : [32,37],
                iconAnchor : [16,35]
            });
        }
        return this.icons[layerInfo.key];
    },
    
    
    // --------------------------------------------
    // STEP 3 : CALCULATE ROUTE TO THE SELECTED POI
    // --------------------------------------------
    
    _initStep3 : function(options) {
        this._initDestinationGeocoder();
        this._initRouting(options);
    },
    
    step3Ready : function() {
        L.DomUtil.removeClass(L.DomUtil.get("FaG-step3"), "FaG-Disable");
    },
    
    _initDestinationGeocoder : function() {
        this.destinationGeocoder = new L.PhotonReverse({
            url: this.PHOTON_REVERSE_GEOCODING_URL, 
            handleResults: L.bind(this.destinationFound, this)
        });
    },
    
    _initRouting : function(options) {
        L.DomEvent.on(L.DomUtil.get("FaG-walk"), "click", 
            L.bind(this.requestRoute, this, "foot"));
        L.DomEvent.on(L.DomUtil.get("FaG-cycle"), "click",
            L.bind(this.requestRoute, this, "bike"));
        L.DomEvent.on(L.DomUtil.get("FaG-drive"), "click",
            L.bind(this.requestRoute, this, "car"));
    },
    
    setDestination: function(marker) {
        
        this.destination = marker.getLatLng();
        
        var destItem = L.DomUtil.get("FaG-destPOI");
        var destName = (marker.options.title ? 
                       marker.options.title + ' (' + marker.options.layerName + ')' :
                       marker.options.layerName);
        destItem.innerHTML = "<strong>" + destName + "</strong>";
        
        this.destinationGeocoder.doReverse(marker.getLatLng());
    },
    
    destinationFound: function(geoJsonData) {
        var addressItem = L.DomUtil.get("FaG-destAddress");
        if (geoJsonData.features.length === 0) {
            addressItem.innerHTML = "Adresse non identifiée ...";
        } else {
            var address = geoJsonData.features[0].properties.label;
            addressItem.innerHTML = address;
        }
    },
    
    requestRoute: function(vehicle) {
        
        var _this = this;
        if (this.route) {
            this.map.removeLayer(this.route);
            this.route = null;
        }
        
        var url = this.buildRoutingRequest(this.location, this.destination, vehicle);
        var request = new XMLHttpRequest();  // Not supported on IE < 10
        request.open("GET", url, true);
        request.onload = function() {
            if (this.status === 200) {
                var response = JSON.parse(this.response);
                _this.displayRoute(response, vehicle);
            } else {
                _this.feedbackRoute("le calcul d'itinéraire n'a pas abouti.");
            }
        };
        request.send();
        this.feedbackRoute("Calcul d'itinéraire en cours ...");
    },
    
    buildRoutingRequest: function(start, dest, vehicle) {
        var query = this.routingPoint(start) + '&' + this.routingPoint(dest);
        query += '&vehicle=' + vehicle + '&locate=fr_FR';
        query += '&key=' + this.options.graphhopperApiKey;
        
        return this.GRAPHHOPPER_BASE_URL + query;
    },
    
    routingPoint : function(coord) {
        return "point=" + coord.lat.toFixed(5) + "," + coord.lng.toFixed(5)
    },
    
    displayRoute: function(result, vehicle) {
        if (result.paths) {
            var path = result.paths[0];
            var distance = this.formatDistance(parseFloat(path.distance));
            var duration = this.formatDuration(path.time * 0.001);
            var typeDesc = (vehicle === 'car') ? 'en voiture' : 
                    (vehicle === 'bike') ? 'en vélo' : 'à pied';
            this.feedbackRoute("Distance " + typeDesc + " : " + 
                    distance + " (durée : " + duration +")");

            this.route = this.pathToPolyline(path, vehicle);
            this.map.addLayer(this.route);
            this.map.fitBounds(this.route.getBounds().pad(0.05));
        }
    },
    
    pathToPolyline: function (path, vehicle) {
        if (path.points_encoded) {
            var points = graphhopper.util.decodePath(path.points);
            var latLngs = [];
            for (var i = 0; i < points.length; i++) {
                latLngs.push(L.latLng(points[i][1], points[i][0]));
            }
            var className = 'FaG-' + vehicle + 'Route';
            var line = L.polyline(latLngs);
            line.setStyle({className: className});
            return line;
        }
    },
    
    feedbackRoute: function(message) {
        var feedbackItem = L.DomUtil.get("FaG-feedbackRoute");
        feedbackItem.innerHTML = message;
    },
    
    formatDistance: function(metres) {
        // Ignore metres above 10 km
        if (metres > 10000) {
            return Math.round(metres * 0.001) + " km";
        } else {
            return Math.round(metres) + " m";
        }
    },
    
    formatDuration: function(seconds) {
        var sec_num = parseInt(seconds, 10),
            hours   = Math.floor(sec_num / 3600),
            minutes = Math.floor((sec_num - (hours * 3600)) / 60),
            seconds = sec_num - (hours * 3600) - (minutes * 60);
        
        var time;
        // Ignore seconds if we're talking of hours
        if (hours > 0) {
            time = hours + ' h ' + minutes + ' m';
        } else if (minutes > 0) {
            time = minutes + ' m ' + seconds + ' s';
        } else {
            time = seconds + ' s';
        }
        return time;
    }
});    
