// import {AnnotationToolkit} from '/node_modules/osd-paperjs-annotation/js/annotationtoolkit.mjs';
import {RotationControlOverlay} from '/node_modules/osd-paperjs-annotation/js/rotationcontrol.mjs';
// let DSA = window.DSA;
let dsaItems = window.App.dsaItems;
console.log('Loaded dsaItems:',dsaItems);


let tilesource1 = dsaItems[3].tileSource;
let tilesource2 = dsaItems[4].tileSource;

const CLICK_MODE = {
    ADD: "ADD",
    REMOVE: "REMOVE"
};

const STATIC_VIEWER_ID = 0;
const MOVING_VIEWER_ID = 1;

let current_click_mode = $('.add-radio').is(':checked') ? CLICK_MODE.ADD : CLICK_MODE.REMOVE;

let drawingCanvas = document.createElement('canvas');

console.log(dsaItems)

tilesource1.hasTransparency = ()=>true; //do this before makeViewer so it is included in TileSource object
tilesource2.hasTransparency = ()=>true; //do this before makeViewer so it is included in TileSource object
let staticViewer = window.viewer1 = makeViewer('viewer-static', tilesource1);
let movingViewer = window.viewer2 = makeViewer('viewer-moving', tilesource2);

let staticViewerState = initializeViewerState(staticViewer, STATIC_VIEWER_ID);
let movingViewerState = initializeViewerState(movingViewer, MOVING_VIEWER_ID);

let viewerState = {
    [STATIC_VIEWER_ID]: staticViewerState,
    [MOVING_VIEWER_ID]: movingViewerState
};

setupCanvasClick(STATIC_VIEWER_ID); // id: 0 for static
setupCanvasClick(MOVING_VIEWER_ID); // id: 1 for moving

setupInfoHandler(staticViewer, $('.image-info.static'));
setupInfoHandler(movingViewer, $('.image-info.moving'));

let transparentGlassRGBThreshold = 10;


App.createImagePicker(staticViewer, movingViewer, $('#imagePickerButton'));


$('.add-radio').on('click', function() {
    current_click_mode = CLICK_MODE.ADD;
    console.log("click mode: ", current_click_mode)
});

$('.remove-radio').on('click', function() {
    current_click_mode = CLICK_MODE.REMOVE;
    console.log("click mode: ", current_click_mode)
});


$('input.glass-checkbox').on('change',function(){
    if(this.checked){
        enableTransparentBackground(staticViewer, transparentGlassRGBThreshold, 0);
        enableTransparentBackground(movingViewer, transparentGlassRGBThreshold, 0);
        // $('.create-viewport-images').attr('disabled',false);
        // $('.create-background-images').attr('disabled',true);
    } else {
        disableTransparentBackground(staticViewer);
        disableTransparentBackground(movingViewer);
        // $('.create-viewport-images').attr('disabled',true);
        // $('.create-background-images').attr('disabled',false);
    }
}).prop('checked',false);

// on opening both images, start syncing the zoom
Promise.all([
    new Promise(resolve=>{
        staticViewer.addOnceHandler('open',function(){
            staticViewer.rotationControl = new RotationControlOverlay(staticViewer);
            // viewer1.AnnotationToolkit = new AnnotationToolkit(viewer1);
            // viewer1.AnnotationToolkit.addAnnotationUI({
            //     autoOpen:true,
            //     addLayerDialog:true,
            // });
            resolve();
        });
    }),
    new Promise(resolve=>{
        movingViewer.addOnceHandler('open',function(){
            movingViewer.rotationControl = new RotationControlOverlay(movingViewer);
            // viewer2.AnnotationToolkit = new AnnotationToolkit(viewer2);
            // viewer2.AnnotationToolkit.addAnnotationUI({
            //     autoOpen:true,
            //     addLayerDialog:true,
            // });
            resolve();
        });
    }),
]).then(initializeSynchronizeBehavior);

$('input.opacity-slider').on('input',function(){
    $('.openseadragon-canvas').css('--stacked-opacity',this.value/100);
}).trigger('input');

$('input.glass-checkbox').on('change',function(){
    if(this.checked){
        enableTransparentBackground(staticViewer, tilesource1.backgroundColor, transparentGlassRGBThreshold, 0);
        enableTransparentBackground(movingViewer, tilesource2.backgroundColor, transparentGlassRGBThreshold, 0);
    } else {
        disableTransparentBackground(staticViewer);
        disableTransparentBackground(movingViewer);
    }
}).attr('checked',false);

$('input.combine-checkbox').on('change',function(){
    if(this.checked){
        $('.viewer-container').addClass('stacked').removeClass('side-by-side');
        staticViewer.rotationControl.deactivate();
    } else {
        $('.viewer-container').addClass('side-by-side').removeClass('stacked');
    }
}).attr('checked',false);

$('input.sync-checkbox').on('change',function(){
    if(this.checked){
        setSynchronizingMatrices();

        staticViewer.addHandler('pan',synchronizingPanHandler);
        movingViewer.addHandler('pan',synchronizingPanHandler);

        staticViewer.addHandler('rotate',synchronizingRotateHandler);
        movingViewer.addHandler('rotate',synchronizingRotateHandler);

        staticViewer.removeHandler('pan', setSynchronizingMatrices);
        movingViewer.removeHandler('pan', setSynchronizingMatrices);
        
        staticViewer.removeHandler('rotate', setSynchronizingMatrices);
        movingViewer.removeHandler('rotate', setSynchronizingMatrices);
    } else {
        staticViewer.removeHandler('pan',synchronizingPanHandler);
        movingViewer.removeHandler('pan',synchronizingPanHandler);

        staticViewer.removeHandler('rotate',synchronizingRotateHandler);
        movingViewer.removeHandler('rotate',synchronizingRotateHandler);

        staticViewer.addHandler('pan', setSynchronizingMatrices);
        movingViewer.addHandler('pan', setSynchronizingMatrices);
        
        staticViewer.addHandler('rotate', setSynchronizingMatrices);
        movingViewer.addHandler('rotate', setSynchronizingMatrices);
    }
}).attr('checked',false);


function setSynchronizingMatrices(){
    //create affine matrices
    //depends on paper.js
    //TO DO: paper.js probably isn't necessary... could likely be implemented with just OpenSeadragon

    let m1 = new paper.Matrix();
    m1.translate(staticViewer.viewport.getCenter(false));
    m1.rotate(-staticViewer.viewport.getRotation(false));
    m1.scale(1/staticViewer.viewport.getZoom(false));
    let m2 = new paper.Matrix();
    m2.translate(movingViewer.viewport.getCenter(false));
    m2.rotate(-movingViewer.viewport.getRotation(false));
    m2.scale(1/movingViewer.viewport.getZoom(false));
    
    let transform1to2 = m2.appended(m1.inverted());
    staticViewer.synchronizedViewers[0].transformMatrix = transform1to2;
    movingViewer.synchronizedViewers[0].transformMatrix = transform1to2.inverted();
}
function setupInfoHandler(viewer, container){
    let x = container.find('.x');
    let y = container.find('.y');
    let r = container.find('.rotation');
    let handler= function(event){
        // console.log('viewport-change', event, viewer, container);
        let center = viewer.viewport.getCenter(true);
        let rotation = viewer.viewport.getRotation(true);
        x.val(center.x);
        y.val(center.y);
        r.val(rotation);
    };
    let events = ['pan','zoom','rotate','resize'];
    events.forEach(event=>viewer.addHandler(event, handler));

    let doPan = function(){
        viewer.viewport.panTo(new OpenSeadragon.Point(Number(x.val()), Number(y.val())), true);
    }
    let doRotate = function(){
        viewer.viewport.rotateTo(Number(r.val()), null, true);
    }
    x.on('change', doPan);
    y.on('change', doPan);
    r.on('change', doRotate);

    //Add mouse tracker to OSD viewer element to watch cursor position
    let imageName = container.find('.image-name').text();
    let coordsContainer = $('.cursor-info');
    let targetElement = coordsContainer.find('.cursor-target');
    let vx = coordsContainer.find('.viewport-coords .x');
    let vy = coordsContainer.find('.viewport-coords .y');
    let ix = coordsContainer.find('.image-coords .x');
    let iy = coordsContainer.find('.image-coords .y');
    let mouseCoords = function(event){
        targetElement.text(imageName);
        let viewport = viewer.viewport.viewerElementToViewportCoordinates(event.position);
        let image = viewer.viewport.viewerElementToImageCoordinates(event.position);
        vx.val(viewport.x);
        vy.val(viewport.y);
        ix.val(image.x);
        iy.val(image.y);
    }
    let leaveHandler = function(event){
        targetElement.text('');
        vx.val('');
        vy.val('');
        ix.val('');
        iy.val('');
    }
    new window.OpenSeadragon.MouseTracker({element: viewer.element, moveHandler: mouseCoords, leaveHandler: leaveHandler});
}
function setupSyncInfoHandler(viewer, container){
    let x = container.find('.x');
    let y = container.find('.y');
    let r = container.find('.rotation');
    let z = container.find('.zoom');
    let handler= function(event){
        //defer to the next event loop so the synchronization handler can execute first
        window.setTimeout(()=>{
            let synced = viewer.synchronizedViewers && viewer.synchronizedViewers[0];
            if(synced){
                let m = synced.transformMatrix;
                let offset = m.translation;
                let rotation = m.rotation;
                let scaling = m.scaling;
                
                x.val(offset.x);
                y.val(offset.y);
                r.val(rotation);
                z.val(scaling.x);
            } 
            
        });
    };

    let events = ['pan','zoom','rotate','resize'];
    events.forEach(event=>viewer.addHandler(event, handler));
}
function initializeSynchronizeBehavior(){
    //perform initial zoom to same real-world coordinates (given by mm_x and width values);
    movingViewer.viewport.zoomTo(staticViewer.viewport.getZoom() * (tilesource2.mm_x * tilesource2.width) / (tilesource1.mm_x * tilesource1.width) );

    staticViewer.synchronizedViewers = [{viewer:movingViewer}];
    movingViewer.synchronizedViewers = [{viewer:staticViewer}];

    setSynchronizingMatrices();

    staticViewer.addHandler('zoom',synchronizingZoomHandler);
    movingViewer.addHandler('zoom',synchronizingZoomHandler);
    staticViewer.addHandler('pan', setSynchronizingMatrices);
    movingViewer.addHandler('pan', setSynchronizingMatrices);
    
    staticViewer.addHandler('rotate', setSynchronizingMatrices);
    movingViewer.addHandler('rotate', setSynchronizingMatrices);

    setupSyncInfoHandler(staticViewer, $('.image-info.matrix'));
    setupSyncInfoHandler(movingViewer, $('.image-info.matrix'));

}

function synchronizingPanHandler(event){
    //self is the viewer initiating the viewport-change event
    let self = event.eventSource;
    //set flag so other viewer won't send return signal
    self.synchronizing = true;
    //arr is the list of viewers to synchronize with
    let arr = self.synchronizedViewers || [];
    arr.forEach(d=>{
        //(potential) target viewer
        let target = d.viewer;
        let transformMatrix = d.transformMatrix;
        
        if(target.synchronizing) return;
        
        if(!target || !transformMatrix){
            console.error('synchronizingViewer data not properly formed');
            return;
        }
        let center = self.viewport.getCenter();
        let newCenter = transformMatrix.transform(new paper.Point(center.x, center.y));
        target.viewport.panTo(newCenter, event.immediately);

    });
    //unset flag
    self.synchronizing=false;
}
function synchronizingZoomHandler(event){
    //self is the viewer initiating the viewport-change event
    let self = event.eventSource;
    //set flag so other viewer won't send return signal
    self.synchronizing = true;
    //arr is the list of viewers to synchronize with
    let arr = self.synchronizedViewers || [];
    arr.forEach(d=>{
        //(potential) target viewer
        let target = d.viewer;
        let transformMatrix = d.transformMatrix;
        
        if(target.synchronizing) return;
        
        if(!target || !transformMatrix){
            console.error('synchronizingViewer data not properly formed');
            return;
        }
        let zoom = self.viewport.getZoom();
        let newZoom = zoom * 1/transformMatrix.scaling.x;
        let refPoint = event.refPoint || self.viewport.getCenter();
        let transformed = transformMatrix.transform(new paper.Point(refPoint.x, refPoint.y));
        let newRefPoint = new OpenSeadragon.Point(transformed.x, transformed.y);
       
        target.viewport.zoomTo(newZoom, newRefPoint, event.immediately);

    });
    //unset flag
    self.synchronizing=false;
}

function synchronizingRotateHandler(event){
    //self is the viewer initiating the viewport-change event
    let self = event.eventSource;
    //set flag so other viewer won't send return signal
    self.synchronizing = true;
    //arr is the list of viewers to synchronize with
    let arr = self.synchronizedViewers || [];
    arr.forEach(d=>{
        //(potential) target viewer
        let target = d.viewer;
        let transformMatrix = d.transformMatrix;
        
        if(target.synchronizing) return;
        
        if(!target || !transformMatrix){
            console.error('synchronizingViewer data not properly formed');
            return;
        }
        let degrees = event.degrees;
        let newDegrees = degrees - transformMatrix.rotation;
        let refPoint = event.pivot || self.viewport.getCenter();
        let transformed = transformMatrix.transform(new paper.Point(refPoint.x, refPoint.y));
        let newRefPoint = new OpenSeadragon.Point(transformed.x, transformed.y);
        target.viewport.rotateTo(newDegrees, newRefPoint, event.immediately);
    });
    //unset flag
    self.synchronizing=false;
}


function makeViewer(id, tileSource){
    return new OpenSeadragon({
        id: id,
        tileSources: tileSource,
        crossOriginPolicy:'Anonymous',
        prefixUrl:'/node_modules/openseadragon/build/openseadragon/images/',
        maxZoomPixelRatio: 10,
        minZoomImageRatio: 0.2,
        visibilityRatio: 0,
        // subPixelRoundingForTransparency: OpenSeadragon.SUBPIXEL_ROUNDING_OCCURRENCES.ALWAYS
    });
}

function initializeViewerState(viewer, id) {
    
    let overlay = viewer.svgOverlay();

    let osdView = {
        viewer: viewer,
        overlay: overlay,
        index: id,
        markers: [],
        dimensions: {
            width: viewer.container.clientWidth,
            height: viewer.container.clientHeight
        }
    }
    return osdView;
}

function setupCanvasClick(viewerId){
    
    let currViewerState = viewerState[viewerId];
    let { viewer } = currViewerState;

    viewer.addHandler('canvas-click', function (event) {
        if (!event.quick) {
          return;
        }

        let pos = viewer.viewport.pointFromPixel(event.position);
        handleClick(currViewerState, pos);

        event.preventDefaultAction = true;
    });
}

function plotMarker(viewerId){
    
    let { viewer, overlay, markers } = viewerState[viewerId];

    let svgNode = overlay.node();
    
    markers = _.map(markers, function(marker){
        if(marker.hasOwnProperty("group")) {
            marker.group.remove();
            return marker.pos;
        }
        else
            return marker;
    });

    viewer.clearOverlays();
    
    viewerState[viewerId].markers = _.map(markers, function (marker, markerIndex) {
        let pos = marker;
        let size = 0.005;
        let halfSize = size * 0.5;

        let group = DSA.createSVGElement('g', svgNode);

        var line = DSA.createSVGElement('line', group, {
            x1: pos.x - halfSize,
            x2: pos.x + halfSize,
            y1: pos.y,
            y2: pos.y,
            stroke: 'red',
            'stroke-width': 0.05
        });

        line = DSA.createSVGElement('line', group, {
            x1: pos.x,
            x2: pos.x,
            y1: pos.y - halfSize,
            y2: pos.y + halfSize,
            stroke: 'red',
            'stroke-width': 0.05
        });

        let text = DSA.createSVGElement('text', group, {
            x: pos.x + halfSize * 0.5,
            y: pos.y - halfSize * 0.5,
            fill: 'red',
            'font-size': 0.04
        });

        text.innerHTML = markerIndex + 1;

        let output = {
            group: group,
            pos: pos
        };

        return output;
    });
}

function onAddMarker(viewerId, marker) {
    viewerState[viewerId].markers.push(marker);
    plotMarker(viewerId);
}

function onRemoveMarker(viewerId, markerId) {
    // delete the svg before removing it from markers
    viewerState[viewerId].markers[markerId].group.remove();
    viewerState[viewerId].markers.splice(markerId, 1);
    plotMarker(viewerId);
}

function handleClick(osdView, pos) {

    if (current_click_mode === CLICK_MODE.ADD) {
        
        // compute the anchor points and add them here
        onAddMarker(osdView.index, pos);

      } else if (current_click_mode === CLICK_MODE.REMOVE) {
        let best;
        osdView.markers.forEach(function (marker, i) {

          let distance = Math.abs(pos.x - marker.pos.x) + Math.abs(pos.y - marker.pos.y);
          if (!best || best.distance > distance) {
            best = {
              marker: marker,
              distance: distance,
              index: i
            };
          }
        });

        if (best && best.distance < 0.025) {
          onRemoveMarker(osdView.index, best.index);
        }
    }
}

function getGlassColor(dsaTileSource){
    let thumbUrl = dsaTileSource.getTileUrl(1,1,1).replace(/\/tiles\/.*/, '/tiles/thumbnail');
    let image = new Image();
    image.crossOrigin = "Anonymous";
    return new Promise((resolve,reject)=>{
        image.onload = function(){
            let w = this.width;
            let h = this.height;
            let canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            let context = canvas.getContext("2d",{willReadFrequently: true});
            context.drawImage(this, 0, 0);

            let left = context.getImageData(0, 0, 1, h);
            let top = context.getImageData(0, 0, w, 1);
            let right = context.getImageData(w-1, 0, 1, h);
            let bottom = context.getImageData(0, h-1, w, 1);

            let length = left.height + top.width + right.height + bottom.width;
            let red = new Array(length);
            let green = new Array(length);
            let blue = new Array(length); 
            let a=0;
            [left, top, right, bottom].forEach(edge=>{
                for(var i=0; i<edge.data.length; i+=4, a+=1){
                    red[a] = edge.data[i];
                    green[a] = edge.data[i+1];
                    blue[a] = edge.data[i+2];
                }
            });

            let medianRed = red.sort()[Math.floor(red.length/2)];
            let medianGreen = green.sort()[Math.floor(green.length/2)];
            let medianBlue = blue.sort()[Math.floor(blue.length/2)];

            let maxDifference = [left, top, right, bottom].map(edge=>{
                let diff = new Array(edge.data.length/4);
                for(var i=0; i<edge.data.length; i+=4, a+=1){
                    diff[a] = Math.max(Math.abs(edge.data[i] - medianRed), Math.abs(edge.data[i+1] - medianGreen), Math.abs(edge.data[i+2] - medianBlue));
                }
                return diff;
            }).flat().sort();
            
            resolve({red: medianRed, green: medianGreen, blue: medianBlue, maxDifference: maxDifference});
        };
        image.onerror = reject;
        image.src = thumbUrl;
    });
}
function enableTransparentBackground(viewer, background, tolerance, alpha){
    $(viewer.element).addClass('transparent-glass');
    viewer.setFilterOptions({
        filters: {
            processors: [
                function(context, callback) {
                    let imData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
                    
                    let newImData = imData;
                    for(var i=0; i<newImData.data.length; i+=4){
                        if(Math.abs(newImData.data[i] - background.red)<tolerance &&
                           Math.abs(newImData.data[i+1] - background.green)<tolerance  &&
                           Math.abs(newImData.data[i+2] - background.blue)<tolerance ){
                            newImData.data[i+3] = alpha;
                           }
                    }

                    context.putImageData(newImData, 0, 0);

                    //make the callback async so the tile cache works appropriately
                    window.setTimeout(()=>callback(context));
                    
                },
            ]
        },
    });
}
function disableTransparentBackground(viewer){
    $(viewer.element).removeClass('transparent-glass');
    viewer.setFilterOptions({
        filters:{
            processors:[]
        }
    })
}

$('.create-viewport-images').on('click',()=>{
    let targetContainer = $('.viewport-image-container');
    targetContainer.empty();
    // let bgImgs = $('.background-images img').toArray();
    createROIImages(targetContainer);
    $('.download-images').attr('disabled',false);
    
});

$('.download-images').on('click',function(){
    let zip = new JSZip();
    // let transformInfo = [];
    let files = $('.image-sets .static-image').toArray().map((staticImg,idx)=>{
        let prefix = 'viewport';
        let movingImg= $(staticImg).data('moving');
        let staticName = prefix + '-static.png';
        let movingName = prefix + '-moving.png';
        
        return Promise.all([
            fetch(staticImg.src).then(response=>response.arrayBuffer()).then(ab=>{
                return zip.file(staticName, ab, {base64: true});
            }),
            fetch(movingImg.src).then(response=>response.arrayBuffer()).then(ab=>{
                return zip.file(movingName, ab, {base64: true});
            }),
        ]);
    });
    // zip.file('info.json',JSON.stringify(transformInfo));
    Promise.all(files).then(()=>{
        zip.generateAsync({type:"blob"}).then(function(content) {
            // see FileSaver.js
            window.saveAs(content, "image-set.zip");
        });
    });
});

function createROIImages(targetContainer){

    movingViewer.viewport.goHome(true);
    staticViewer.viewport.goHome(true);
    
    // let staticImageData = getImageRect(staticViewer, 'image/png');
    let staticImage = $('<img>',{src:getImageUrl(staticViewer, 'image/png'), class:'static-image'}).appendTo(targetContainer);

    // let movingImageData = getImageRect(movingViewer, 'image/png');
    let movingImage = $('<img>',{src:getImageUrl(movingViewer, 'image/png'), class:'moving-image'}).appendTo(targetContainer);

    staticImage.data({moving:movingImage[0],static:staticImage[0]});
    movingImage.data({moving:movingImage[0],static:staticImage[0]});
}

function getImageUrl(viewer, type='image/jpg'){
    // let pixelRatio = OpenSeadragon.pixelDensityRatio;
    // let center_x = viewer.drawer.canvas.width/2;
    // let center_y = viewer.drawer.canvas.height/2;
    // let w = drawingCanvas.width;
    // let h = drawingCanvas.height;
    // let left = Math.round(center_x - w*pixelRatio/2);
    // let top = Math.round(center_y - h*pixelRatio/2);
    
    // let ctx = drawingCanvas.getContext("2d",{willReadFrequently: true});
    // ctx.imageSmoothingEnabled = false;
    // ctx.clearRect(0, 0, w, h);
    // ctx.drawImage(viewer.drawer.canvas, left, top, w*pixelRatio, h*pixelRatio, 0, 0, w, h);

    return viewer.drawer.canvas.toDataURL(type);
}

$('.autoregister-checkbox').on('click', function() {
    if ($('.autoregister-checkbox').is(':checked')) {
        current_click_mode = CLICK_MODE.ADD;
        ProcessImages();
      }
});

    function ProcessImages() {

    movingViewer.viewport.goHome(true);
    staticViewer.viewport.goHome(true);

    let source1 = $('<img>',{src:getImageUrl(movingViewer, 'image/png')})[0];
    let source1ID = viewerState[MOVING_VIEWER_ID].index;

    let source2 = $('<img>',{src:getImageUrl(staticViewer, 'image/png')})[0];
    let source2ID = viewerState[STATIC_VIEWER_ID].index;

    console.log("source1", source1);
    console.log("source2", source2);

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

    // var orb = new cv.AKAZE();    // less keypoints detected
    var orb = new cv.ORB();     // more keypoints detected

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
    let knnDistance_option = 0.5;  // lesser the value more the matches
    let good_matches = new cv.DMatchVector();

    let bf = new cv.BFMatcher();

    let matches = new cv.DMatchVectorVector();
    

    bf.knnMatch(descriptors1, descriptors2, matches, 2);      
    
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
        anchorPoints.push(transformPoint({layer: source1ID, pt: keypoints1.get(queryIdx).pt}));
        anchorPoints.push(transformPoint({layer: source2ID, pt: keypoints2.get(trainIdx).pt}));
    }
    console.log("anchorPoints: ", anchorPoints);

    // plot anchor points
    // qID = keypt1 | trainId = keypt2

    anchorPoints.forEach(anchor => {
      let { layer, pt } = anchor;
      handleClick(viewerState[layer], pt);
    });
   
    console.log('plotted')
  }

// convert image coordinates to viewport coordinates
function transformPoint(anchorPt) {
    let { layer, pt } = anchorPt;
    
    // console.log("pt before: ", pt);
   
    let osdPoint = new OpenSeadragon.Point(pt.x, pt.y)
    pt = viewerState[layer].viewer.viewport.pointFromPixel(osdPoint);

    pt.x *= viewerState[layer].viewer.viewport.getContainerSize().x / viewerState[layer].dimensions["width"];
    pt.y *= viewerState[layer].viewer.viewport.getContainerSize().y / viewerState[layer].dimensions["height"];
    
    // console.log("pt after: ", pt);

    anchorPt.pt = pt;
    return anchorPt;
}