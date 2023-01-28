// import {AnnotationToolkit} from '/node_modules/osd-paperjs-annotation/js/annotationtoolkit.mjs';
import {RotationControlOverlay} from '/node_modules/osd-paperjs-annotation/js/rotationcontrol.mjs';
// let DSA = window.DSA;
let dsaItems = window.App.dsaItems;
console.log('Loaded dsaItems:',dsaItems);

let tilesource1 = dsaItems[1].tileSource;
let tilesource2 = dsaItems[0].tileSource;
tilesource1.hasTransparency = ()=>true; //do this before makeViewer so it is included in TileSource object
tilesource2.hasTransparency = ()=>true; //do this before makeViewer so it is included in TileSource object
let staticViewer = window.viewer1 = makeViewer('viewer-static', tilesource1);
let movingViewer = window.viewer2 = makeViewer('viewer-moving', tilesource2);
setupInfoHandler(staticViewer, $('.image-info.static'));
setupInfoHandler(movingViewer, $('.image-info.moving'));

let transparentGlassRGBThreshold = 10;
let transparentGlassEdgeThreshold = 0.5;

getGlassColor(tilesource1).then(color=>{
    tilesource1.backgroundColor = color;
    $(staticViewer.element).css('--background-color',`rgb(${color.red}, ${color.green}, ${color.blue})`);
    if(color.maxDifference.filter(d=>d<transparentGlassRGBThreshold).length / color.maxDifference.length > transparentGlassEdgeThreshold){
        enableTransparentBackground(staticViewer, color, transparentGlassRGBThreshold, 0);
        $('input.glass-checkbox').attr('checked',true);
    }
});
getGlassColor(tilesource2).then(color=>{
    tilesource2.backgroundColor = color;
    $(movingViewer.element).css('--background-color',`rgb(${color.red}, ${color.green}, ${color.blue})`);
    if(color.maxDifference.filter(d=>d<transparentGlassRGBThreshold).length / color.maxDifference.length > transparentGlassEdgeThreshold){
        enableTransparentBackground(movingViewer, color, transparentGlassRGBThreshold, 0);
        $('input.glass-checkbox').attr('checked',true);
    }
});

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

$('.create-viewport-images').on('click',function(){
    console.log('buttton clicked');
    let staticImage = staticViewer.drawer.canvas.toDataURL('img/jpeg');
    $('.image-info.viewport-images .static').empty().append($('<img>',{src:staticImage}));

    let movingImage = movingViewer.drawer.canvas.toDataURL('img/jpeg');
    $('.image-info.viewport-images .moving').empty().append($('<img>',{src:movingImage}));
})

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
        //clear viewport images, since the view has changed
        $('.image-info.viewport-images .viewport-image-container').empty();
        
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
    });
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
    viewer.setFilterOptions({
        filters:{
            processors:[]
        }
    })
}
