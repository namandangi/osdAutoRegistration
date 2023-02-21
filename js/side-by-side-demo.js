'use strict';
(function () {
  // ----------
  window.App = _.extend(window.App || {}, {
    // ----------
    init: function () {
      var self = this;

      this.$top = $('.top');
      this.$bottom = $('.bottom');
      this.$sideBySideControls = $('.side-by-side-controls');

      var urlParams = DSA.getUrlParams();

      this.noneRadio = document.querySelector('.none-radio');
      this.addRadio = document.querySelector('.add-radio');
      this.removeRadio = document.querySelector('.remove-radio');
      this.syncCheckbox = document.querySelector('.sync-checkbox');
      var combineCheckbox = document.querySelector('.combine-checkbox');
      var logDataCheckbox = document.querySelector('.log-data-checkbox');

      this.noneRadio.addEventListener('click', function () {
        self.viewer.setClickMode('none');
      });

      this.addRadio.addEventListener('click', function () {
        self.viewer.setClickMode('add');
      });

      this.removeRadio.addEventListener('click', function () {
        self.viewer.setClickMode('remove');
      });

      this.syncCheckbox.addEventListener('click', function () {
        self.viewer.setSyncMode(self.syncCheckbox.checked);
      });

      combineCheckbox.addEventListener('click', function () {
        if (combineCheckbox.checked) {
          self.startCombined();
        } else {
          self.startSeparate();
        }
      });
      logDataCheckbox.addEventListener('click', function () {
        if (logDataCheckbox.checked) {
          console.log("testing stuff")
          self.LogData();
        }
      });
      /* Note here you can specify various starting data sets using the urlParams data */


      //var dataSetKey = 'exampleSet1With2';
      var dataSetKey = 'llmpptwo'; //better default data set

      if (urlParams.data === 'derm') {
        dataSetKey = 'dsaItemsWith2';
      }
      if (urlParams.data === 'llmpp') {
        dataSetKey = 'llmpp';
      }

      if (urlParams.data === 'dermviva') {
        dataSetKey = 'dermviva';
      }

      console.log('loading' + dataSetKey);
      console.log(dataSetKey);

      DSA.dataSetManager.get(
        dataSetKey,
        function (dataSet) {
          console.log(dataSet);
          self.originalLayers = _.map(dataSet, function (layer) {
            return _.extend({}, layer, {
              rotation: 0
            });
          });
          self.startSeparate();
        },
        function (error) {
          alert(error);
        }
      );
    },

    // ----------
    startSeparate: function () {
      var self = this;
      // debugger
      if (this.viewer) {
        this.viewer.destroy();
      }

      this.$sideBySideControls.show();

      this.layers = this.originalLayers.slice().reverse();

      var tileSources = _.pluck(this.layers, 'tileSource');

      this.viewer = new DSA.SideBySideViewer({
        container: document.querySelector('.viewer-container'),
        state: {
          layers: this.layers
        },
        options: {
          prefixUrl: '/node_modules/openseadragon/build/openseadragon/images/',
          maxZoomPixelRatio: 5,
          crossOriginPolicy: true
        },
        onOpen: function () {
          self.addColorizeSliders();
          self.updateShims(true);
        },
        onAddMarker: function (layerIndex, marker) {
          self.layers[layerIndex].markers.push(marker);
          self.viewer.setState({
            layers: self.layers
          });
        },
        onRemoveMarker: function (layerIndex, markerIndex) {
          self.layers[layerIndex].markers.splice(markerIndex, 1);
          self.viewer.setState({
            layers: self.layers
          });
        }
      });

      if (this.addRadio.checked) {
        this.viewer.setClickMode('add');
      } else if (this.removeRadio.checked) {
        this.viewer.setClickMode('remove');
      }

      this.viewer.setSyncMode(this.syncCheckbox.checked);

      this.$top.empty();
      this.$bottom.empty();
    },

    // ----------
    LogData: function() {
      console.log(this.viewer)
      let imageTileUrls = [];
      // let id = 0;
      // this.viewer._osdViews.forEach((view) => {
      //   let { viewer } = view;        
      //   let {_tilesLoaded} = viewer.world.getItemAt(0)._tileCache;
      //   imageTileUrls.push({id: id, tileSource: _tilesLoaded[0].tile.url});
      //   id++;
      // });

        // {
        //   "001": [{..}],
        //   "010": [{..}],
        // }

      console.log("tiles", this.viewer._tileImages);

      for(let key in this.viewer._tileImages){
        if(this.viewer._tileImages[key].length == 2)
          this.ProcessImages(this.viewer._tileImages[key]);
      }
      
    },

    findPair: function(data) {
      // 0 0 0  | 0
      // 0 0 0  | 1
      // 1 0 0  | 0
      // 1 0 0  | 1
      // 1 0 1  | 0
      // 1 0 1  | 1
      // 1 1 0  | 0
      // 2 0 1  | 1
      // 1 1 1  | 1
      // 2 1 1  | 1
      // 2 0 0  | 1
      // 2 1 0  | 1
      // 2 0 2  | 1 
      // 2 1 2  | 1
    },

    // ---------
    ProcessImages: function (imageList) {
      console.log("testing in process")
      let source1 = imageList[0].tile;
      let source1ID = imageList[0].id;

      let source2 = imageList[1].tile;
      let source2ID = imageList[1].id;

      console.log("source1", source1ID);
      console.log("source2", source2ID);

      // step 1
      let im1 = cv.imread(source1);
      let im2 = cv.imread(source2);

      // step 2
      let im1Gray = new cv.Mat();
      let im2Gray = new cv.Mat();

      cv.cvtColor(im1, im1Gray, cv.COLOR_BGRA2GRAY);
      cv.cvtColor(im2, im2Gray, cv.COLOR_BGRA2GRAY);

      console.log("im2gray:", im2Gray);

      // step 3
      let keypoints1 = new cv.KeyPointVector();
      let keypoints2 = new cv.KeyPointVector();
      let descriptors1 = new cv.Mat();
      let descriptors2 = new cv.Mat();

      // var orb = new cv.AKAZE();
      var orb = new cv.ORB();

      orb.detectAndCompute(im1Gray, new cv.Mat(), keypoints1, descriptors1);
      orb.detectAndCompute(im2Gray, new cv.Mat(), keypoints2, descriptors2);

      // mid way test
      console.log("Total of ", keypoints1.size(), " keypoints1 (img to align) and ", keypoints2.size(), " keypoints2 (reference)");
      console.log("here are the first 5 keypoints for keypoints1:");
      for (let i = 0; i < keypoints1.size(); i++) {
        console.log("keypoints1: [",i,"]", keypoints1.get(i).pt.x, keypoints1.get(i).pt.y);
        if (i === 5){break;}
      }

      for (let i = 0; i < keypoints2.size(); i++) {
        console.log("keypoints2: [",i,"]", keypoints2.get(i).pt.x, keypoints2.get(i).pt.y);
        if (i === 5){break;}
      }

      // step 4
// -- brute force hamming --
      // let bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
      // let matches = new cv.DMatchVector();

      // bf.match(descriptors1, descriptors2, matches);

      // console.log("matches:", matches);

// -- knn matching --      
      let knnDistance_option = 0.78;
      let good_matches = new cv.DMatchVector();

      let bf = new cv.BFMatcher();

      let matches = new cv.DMatchVectorVector();
      

      bf.knnMatch(descriptors1, descriptors2, matches, 2);      
      
      console.log("matches:", matches);

      let counter = 0;
      for (let i = 0; i < matches.size(); ++i) {
          let match = matches.get(i);
          let dMatch1 = match.get(0);
          let dMatch2 = match.get(1);
          // console.log("[", i, "] ", "dMatch1: ", dMatch1, "dMatch2: ", dMatch2);
          if (dMatch1.distance <= dMatch2.distance * parseFloat(knnDistance_option)) {
              console.log("***Good Match***", "dMatch1.distance: ", dMatch1.distance, "was less than or = to: ", "dMatch2.distance * parseFloat(knnDistance_option)", dMatch2.distance * parseFloat(knnDistance_option), "dMatch2.distance: ", dMatch2.distance, "knnDistance", knnDistance_option);
              good_matches.push_back(dMatch1);
              counter++;
          }
      }

      // -- sanity check for step 4 -- 
      // logging data
      console.log("keeping ", counter, " points in good_matches vector out of ", matches.size(), " contained in this match vector:", matches);
      console.log("here are first 5 matches");
      for (let t = 0; t < matches.size(); ++t) {
          console.log("[" + t + "]", "matches: ", matches.get(t));
          if (t === 5){break;}
      }
        
      console.log("here are first 5 good_matches");
      for (let r = 0; r < good_matches.size(); ++r) {
          console.log("[" + r + "]", "good_matches: ", good_matches.get(r));
          if (r === 5){break;}
      }

      // step 5
      console.log("creating anchor point objs");
      let anchorPoints = [];
      for (let r = 0; r < good_matches.size(); ++r) {
        let match = good_matches.get(r);
        let { queryIdx, trainIdx } = match;
        anchorPoints.push({layer: source1ID, pt: keypoints1.get(queryIdx).pt});
        anchorPoints.push({layer: source2ID, pt: keypoints2.get(trainIdx).pt});
      }
      console.log("anchorPoints: ", anchorPoints);

      // plot anchor points
      // qID = keypt1 | trainId = keypt2
      console.log("testing layer:", this.layers);
      console.log("testing viewer:", this.viewer);

      anchorPoints.forEach(anchor => {
        let { layer, pt } = anchor;
        // console.log(this.viewer._osdViews[layer], pt);
        this.viewer._handleClick(this.viewer._osdViews[layer], pt);
      });
      console.log('plotted')
    },

    // ----------
    startCombined: function () {
      var self = this;

      if (this.viewer) {
        this.viewer.destroy();
      }

      this.$sideBySideControls.hide();

      this.layers = this.originalLayers.slice();

      this.viewer = new DSA.OverlaidViewer({
        container: document.querySelector('.viewer-container'),
        state: {
          layers: this.layers
        },
        options: {
          prefixUrl: '/lib/openseadragon/images/',
          maxZoomPixelRatio: 5,
          crossOriginPolicy: true
        },
        onOpen: function () {
          self.addColorizeSliders(true);
          self.updateShims(true);
        }
      });

      this.$top.empty();
      this.$bottom.empty();

      this.addSlider({
        container: this.$top,
        label: 'Opacity',
        min: 0,
        max: 1,
        step: 0.01,
        value: this.layers[1].opacity,
        onChange: function (value) {
          self.layers[1].opacity = value;
          self.update();
        }
      });

      this.addSlider({
        container: this.$bottom,
        label: 'Opacity',
        min: 0,
        max: 1,
        step: 0.01,
        value: this.layers[0].opacity,
        onChange: function (value) {
          self.layers[0].opacity = value;
          self.update();
        }
      });
    },

    // ----------
    addColorizeSliders: function (flip) {
      var self = this;

      var topIndex, bottomIndex;
      if (flip) {
        topIndex = 1;
        bottomIndex = 0;
      } else {
        topIndex = 0;
        bottomIndex = 1;
      }

      this.addSliderSet({
        container: this.$top,
        layerIndex: topIndex
      });

      this.addSliderSet({
        container: this.$bottom,
        layerIndex: bottomIndex
      });
    },

    // ----------
    addSliderSet: function (args) {
      var self = this;

      var colorizeSlider = this.addSlider({
        container: args.container,
        label: 'Colorize',
        min: 0,
        max: 1,
        step: 0.01,
        value: this.layers[args.layerIndex].colorize,
        onChange: function (value) {
          self.layers[args.layerIndex].colorize = value;
          self.update();
        }
      });

      var hueSlider = this.addSlider({
        container: args.container,
        label: 'Hue',
        min: 0,
        max: 360,
        step: 1,
        value: this.layers[args.layerIndex].hue,
        onChange: function (value) {
          self.layers[args.layerIndex].hue = value;
          self.update();
        }
      });

      this.addSlider({
        container: args.container,
        label: 'Brightness',
        min: -1,
        max: 1,
        step: 0.01,
        value: this.layers[args.layerIndex].brightness,
        onChange: function (value) {
          self.layers[args.layerIndex].brightness = value;
          self.update();
        }
      });

      this.addSlider({
        container: args.container,
        label: 'Contrast',
        min: -1,
        max: 1,
        step: 0.01,
        value: this.layers[args.layerIndex].contrast,
        onChange: function (value) {
          self.layers[args.layerIndex].contrast = value;
          self.update();
        }
      });

      var shimFactor = 1;
      var pixelWidth = Math.round(this.viewer.getLayerPixelWidth(args.layerIndex) * shimFactor);
      var pixelHeight = Math.round(this.viewer.getLayerPixelWidth(args.layerIndex) * shimFactor);

      this.addSlider({
        container: args.container,
        label: 'Shim X',
        min: -pixelWidth,
        max: pixelWidth,
        step: 1,
        value: this.layers[args.layerIndex].shimX,
        onChange: function (value) {
          self.layers[args.layerIndex].shimX = value;
          self.update();
        }
      });

      this.addSlider({
        container: args.container,
        label: 'Shim Y',
        min: -pixelHeight,
        max: pixelHeight,
        step: 1,
        value: this.layers[args.layerIndex].shimY,
        onChange: function (value) {
          self.layers[args.layerIndex].shimY = value;
          self.update();
        }
      });

      this.addSlider({
        container: args.container,
        label: 'Rotation',
        min: -180,
        max: 180,
        step: 0.1,
        value: this.layers[args.layerIndex].rotation,
        onChange: function (value) {
          self.layers[args.layerIndex].rotation = value;
          self.update();
        }
      });

      this.addColorPalette({
        container: args.container,
        onClick: function (hue) {
          self.layers[args.layerIndex].colorize = 1;
          colorizeSlider.setValue(1);
          self.layers[args.layerIndex].hue = hue;
          hueSlider.setValue(hue);
          self.update();
        }
      });
    },

    // ----------
    update: function () {
      this.viewer.setState({
        layers: this.layers
      });

      this.updateShims();
    },

    // ----------
    updateShims: function (immediately) {
      var self = this;
      _.each(this.layers, function (layer, layerIndex) {
        self.viewer.setLayerPixelOffset(layerIndex, layer.shimX, layer.shimY, immediately);
      });
    }
  });

  // ----------
  setTimeout(function () {
    App.init();
  }, 1);
})();
