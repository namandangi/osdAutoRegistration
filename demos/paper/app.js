// import {AnnotationToolkit} from '/node_modules/osd-paperjs-annotation/js/annotationtoolkit.mjs';
import {RotationControlOverlay} from '/node_modules/osd-paperjs-annotation/js/rotationcontrol.mjs';
// let DSA = window.DSA;
let dsaItems = window.App.dsaItems;
console.log('Loaded dsaItems:',dsaItems);

let tilesource1 = dsaItems[3].tileSource;
let tilesource2 = dsaItems[4].tileSource;

console.log(dsaItems)

tilesource1.hasTransparency = ()=>true; //do this before makeViewer so it is included in TileSource object
tilesource2.hasTransparency = ()=>true; //do this before makeViewer so it is included in TileSource object
let viewer1 = window.viewer1 = makeViewer('viewer1', tilesource1);
let viewer2 = window.viewer2 = makeViewer('viewer2', tilesource2);

getGlassColor(tilesource1).then(color=>{
    enableTransparentBackground(viewer1, color, 10, 0.2);
});
getGlassColor(tilesource2).then(color=>{
    enableTransparentBackground(viewer2, color, 10, 0.2);
});

// on opening both images, start syncing the zoom
Promise.all([
    new Promise(resolve=>{
        viewer1.addOnceHandler('open',function(){
            viewer1.rotationControl = new RotationControlOverlay(viewer1);
            // viewer1.AnnotationToolkit = new AnnotationToolkit(viewer1);
            // viewer1.AnnotationToolkit.addAnnotationUI({
            //     autoOpen:true,
            //     addLayerDialog:true,
            // });
            resolve();
        });
    }),
    new Promise(resolve=>{
        viewer2.addOnceHandler('open',function(){
            viewer2.rotationControl = new RotationControlOverlay(viewer2);
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

$('input.combine-checkbox').on('change',function(){
    if(this.checked){
        $('.viewer-container').addClass('stacked').removeClass('side-by-side');
        viewer1.rotationControl.deactivate();
    } else {
        $('.viewer-container').addClass('side-by-side').removeClass('stacked');
    }
}).attr('checked',false);

$('input.sync-checkbox').on('change',function(){
    if(this.checked){
        setSynchronizingMatrices();

        viewer1.addHandler('pan',synchronizingPanHandler);
        viewer2.addHandler('pan',synchronizingPanHandler);

        viewer1.addHandler('rotate',synchronizingRotateHandler);
        viewer2.addHandler('rotate',synchronizingRotateHandler);

        viewer1.removeHandler('pan', setSynchronizingMatrices);
        viewer2.removeHandler('pan', setSynchronizingMatrices);
        
        viewer1.removeHandler('rotate', setSynchronizingMatrices);
        viewer2.removeHandler('rotate', setSynchronizingMatrices);
    } else {
        viewer1.removeHandler('pan',synchronizingPanHandler);
        viewer2.removeHandler('pan',synchronizingPanHandler);

        viewer1.removeHandler('rotate',synchronizingRotateHandler);
        viewer2.removeHandler('rotate',synchronizingRotateHandler);

        viewer1.addHandler('pan', setSynchronizingMatrices);
        viewer2.addHandler('pan', setSynchronizingMatrices);
        
        viewer1.addHandler('rotate', setSynchronizingMatrices);
        viewer2.addHandler('rotate', setSynchronizingMatrices);
    }
}).attr('checked',false);

function setSynchronizingMatrices(){
    //create affine matrices
    //depends on paper.js
    //TO DO: paper.js probably isn't necessary... could likely be implemented with just OpenSeadragon

    let m1 = new paper.Matrix();
    m1.translate(viewer1.viewport.getCenter(false));
    m1.rotate(-viewer1.viewport.getRotation(false));
    m1.scale(1/viewer1.viewport.getZoom(false));
    let m2 = new paper.Matrix();
    m2.translate(viewer2.viewport.getCenter(false));
    m2.rotate(-viewer2.viewport.getRotation(false));
    m2.scale(1/viewer2.viewport.getZoom(false));
    
    let transform1to2 = m2.appended(m1.inverted());
    viewer1.synchronizedViewers[0].transformMatrix = transform1to2;
    viewer2.synchronizedViewers[0].transformMatrix = transform1to2.inverted();
}

function initializeSynchronizeBehavior(){
    //perform initial zoom to same real-world coordinates (given by mm_x and width values);
    viewer2.viewport.zoomTo(viewer1.viewport.getZoom() * (tilesource2.mm_x * tilesource2.width) / (tilesource1.mm_x * tilesource1.width) );

    viewer1.synchronizedViewers = [{viewer:viewer2}];
    viewer2.synchronizedViewers = [{viewer:viewer1}];

    setSynchronizingMatrices();

    viewer1.addHandler('zoom',synchronizingZoomHandler);
    viewer2.addHandler('zoom',synchronizingZoomHandler);
    viewer1.addHandler('pan', setSynchronizingMatrices);
    viewer2.addHandler('pan', setSynchronizingMatrices);
    
    viewer1.addHandler('rotate', setSynchronizingMatrices);
    viewer2.addHandler('rotate', setSynchronizingMatrices);
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
            
            resolve({red: medianRed, green: medianGreen, blue: medianBlue});
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

                    callback(context);
                    
                },
            ]
        },
    });
}
