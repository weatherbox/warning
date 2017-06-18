$(function(){
	mapboxgl.accessToken = 'pk.eyJ1IjoidGF0dGlpIiwiYSI6ImNqMWFrZ3ZncjAwNmQzM3BmazRtNngxam8ifQ.DNMc6j7E4Gh7UkUAaEAPxA';
	var map = new mapboxgl.Map({
		container: 'map',
		style: 'mapbox://styles/tattii/cj3jrmgsp002i2rt50tobxo27',
		zoom: 5,
		center: [136.6, 35.5]
	});
	map.fitBounds([[127, 24], [147, 46]])

	var popup = new mapboxgl.Popup({
		closeButton: false
	});

	var zoomThreshold = 6;
	var selected;
	var $sidebar = $("#sidebar");


	// responsive
	var mobile = $(window).width() < 640;
	if (mobile){

	}else{ // pc
		$sidebar.removeClass("bottom").addClass("left");
		$("#sidebar-close").show();
		$("#sidebar-close").on("click", function(){
			$sidebar.sidebar("hide");
		});
	}


	map.on("load", function() {
		addVtileLayer('pref');
		addVtileLayer('city');

		overlayWarning('pref');
		overlayWarning('city');

		// map event
		var moving = false, zooming = false; // only pc

		if (mobile){
			map.on('mousemove', selectArea);

		}else{
			map.on('mousemove', hoverArea);
			map.on('click', selectArea);
			map.on('movestart', function (){ moving = true; });
			map.on('moveend', function (){ moving = false; });
			map.on('zoomstart', function (){ zooming = true; });
			map.on('zoomend', function (){ zooming = false; });
		}

		function hoverArea (e){
			if (moving || zooming) return false;

			var show_layer = (map.getZoom() <= zoomThreshold) ? 'pref' : 'city';
			var features = map.queryRenderedFeatures(e.point, { layers: ['warning-area-' + show_layer] });
			map.getCanvas().style.cursor = (features.length) ? 'crosshair' : '';

			if (!features.length) {
				popup.remove();
				return;
			}

			var feature = features[0];
			var name_prop = (show_layer == 'city') ? 'name' : show_layer + 'Name';

			popup.setLngLat(e.lngLat)
				.setText(feature.properties[name_prop])
				.addTo(map);
		}

		function selectArea (e){
			var show_layer = (map.getZoom() <= zoomThreshold) ? 'pref' : 'city';
			var features = map.queryRenderedFeatures(e.point, { layers: ['warning-area-' + show_layer] });

			if (!features.length){
				if (mobile){
					map.setFilter("selected-area-" + show_layer, ["==", "", ""]);
					selected = null;
					$sidebar.sidebar("hide");
				}
				return;
			}

			// show selected area on map
			if (!mobile) map.getCanvas().style.cursor = 'pointer';
			var code_prop = (show_layer == 'city') ? 'code' : show_layer + 'Code';
			var code = features[0].properties[code_prop];
			map.setFilter("selected-area-" + show_layer, ["==", code_prop, code]);

			// show data on sidebar
			if (!selected || code != selected.code){
				updateSidebar(code, features[0]);
			}

			if ($sidebar.sidebar("is hidden")){
				$sidebar.sidebar('setting', 'transition', 'overlay')
				.sidebar('setting', 'dimPage', false)
				.sidebar('setting', 'closable', false)
				.sidebar('show');
			}

			selected = { feature: features[0], code: code, code_prop: code_prop };
		}
	});


	function addVtileLayer (layer){
		var source_layer = ((layer == 'city') ? '' : layer) + 'allgeojson';
		var source_suffix = (layer == 'city') ? '' : '-' + layer;

		map.addSource("vtile-" + layer, {
			"type": "vector",
			"minzoom": 0,
			"maxzoom": 10,
			"tiles": ["https://s3-ap-northeast-1.amazonaws.com/vector-tile/warning-area" + source_suffix + "/{z}/{x}/{y}.pbf"],
			"attribution": '<a href="http://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-v2_3.html" target="_blank">国土数値情報</a>'
		});

		var layer_setting = {
			"id": "warning-area-" + layer,
			"type": "fill",
			"source": "vtile-" + layer,
			"source-layer": source_layer,
			"paint": {
				"fill-color": "rgba(255, 255, 255, 0)",
				"fill-outline-color": "rgba(123, 124, 125, 0.7)"
			}
		};
		if (layer == 'pref'){
			layer_setting.maxzoom = zoomThreshold;
		}else{
			layer_setting.minzoom = zoomThreshold;
		}
		map.addLayer(layer_setting);
	}

	function selectLayer (layer){
		var source_layer = ((layer == 'city') ? '' : layer) + 'allgeojson';

		var filter = ["==", "code", ""];
		if (selected){
			var code_prop = (layer == 'city') ? 'code' : layer + 'Code';
			if (selected.feature && selected.feature.properties[code_prop]){
				// upscale
				filter = ["==", code_prop, selected.feature.properties[code_prop]];
				if ($sidebar.sidebar("is visible")){
					updateSidebar(selected.feature.properties[code_prop], selected.feature);
				}
			}else{
				// downscale
				filter = ["==", selected.code_prop, selected.code];
			}
		}

		map.addLayer({
			"id": "selected-area-" + layer,
			"type": "fill",
			"source": "vtile-" + layer,
			"source-layer": source_layer,
			"paint": {
				"fill-color": "rgba(245, 143, 152, 0.4)",
				"fill-outline-color": "rgba(245, 143, 152, 0.7)"
			},
			"filter": filter
		});
	}


	function overlayWarning (layer){
		$.get('https://s3-ap-northeast-1.amazonaws.com/vector-tile/warning/' + layer + '.json.gz', function (data){
			console.log(data);

			var source_layer = ((layer == 'city') ? '' : layer) + 'allgeojson';
			var code_prop = (layer == 'city') ? 'code' : layer + 'Code';

			var filter = ["in", code_prop];

			for (var code in data[layer + 'list']){
				if (data[layer + 'list'][code].status == 'advisory'){
					filter.push(code);
				}
			}

			var layer_setting = {
				"id": "selected-area-" + layer,
				"type": "fill",
				"source": "vtile-" + layer,
				"source-layer": source_layer,
				"paint": {
					"fill-color": "rgba(254, 242, 99, 0.4)",
					"fill-outline-color": "rgba(123, 124, 125, 0.7)"
				},
				"filter": filter
			};

			if (layer == 'pref'){
				layer_setting.maxzoom = zoomThreshold;
			}else{
				layer_setting.minzoom = zoomThreshold;
			}

			map.addLayer(layer_setting);
		});
	}

	function updateSidebar (code, feature, wlayer){
		var name_prop = (show_layer == 'city') ? 'name' : show_layer + 'Name';
		$("#sidebar-title h2").text(feature.properties[name_prop]);
		setJMALink(code);
	}

	function setJMALink (code){
		var pcode = parseInt(code.substr(0, 2)), fcode;
		if (pcode == 1){
			fcode = "0" + code.substr(2, 1);
		}else if (pcode == 47){
			fcode = 53 + parseInt(code.substr(3,1));
		}else{
			var jma_pref_code = [
				8, 10, 12, 9, 11, 13, 14, 16, 15, 17, 18, 19, 20, 23, 24, 25, 26, 21, 22, 
				28, 27, 29, 30, 34, 33, 31, 32, 35, 36,
				39, 38, 40, 38, 45, 43, 41, 42, 44,
				46, 47, 48, 49, 50, 51, 52
			];
			fcode = ("0" + jma_pref_code[pcode - 2]).slice(-2);
		}

		if (show_layer == "pref"){
			$("#jma-link a").attr("href", "http://www.jma.go.jp/jp/warn/3" + fcode + ".html");
		}else if (show_layer == "city"){
			$("#jma-link a").attr("href", "http://www.jma.go.jp/jp/warn/f_" + code.substr(0, 6) + "0.html"); 
		}else{
			$("#jma-link a").attr("href", "http://www.jma.go.jp/jp/warn/3" + fcode + "_table.html#" + code);
		}
	}


});
