var Raytracer = function(params){
    // A simple raytracer based on some previous work 
    // done by me during the previous half of the year 
    // and with many ideas copied from antirez's jsrt.
    
    // ugh, js
    'use strict';
    log('raytracer started');

    // Basic vars needed to start the raytracer
    // pixels stores the 4*WIDTH*HEIGHT matrix
    // needed to store the result image
    var SCREEN_WIDTH = params.screen_width || 800,
        SCREEN_HEIGHT = params.screen_height || 400,
        MAX_REFLECTION_RECURSION = 3,
        ENABLE_REFLECTIONS = true,
        pixels = null;

    // Initialization of the canvas and return of the
    // rendering function that is offered as main public
    // API
    function initialize() {
        var ctx = document.getElementById('canvas').getContext('2d');
        pixels = ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
        return {
            // arguments: scene and the point of space 
            // looking towards it
            render: function(scene, pov){
                log('rendering');
                // trace the scene
                scene.trace_scene(pov);
                // set the pixels on the canvas
                ctx.putImageData(pixels, 0, 0);
                log('rendered');
            }
        }
    };

    // Computes 
    Sphere.prototype.normal_to_point = function(x, y, z){
        x -= this.center.x;
        y -= this.center.y;
        z -= this.center.z;

        return new Vec3f(
            x/this.radius,
            y/this.radius,
            z/this.radius
        );
    };

    // Computes the intersection of a sphere
    Sphere.prototype.intersect = function(ray){
        var x, y, z, distance = +Infinity;

        x = this.center.x - ray.origin.x;
        y = this.center.y - ray.origin.y;
        z = this.center.z - ray.origin.z;

        // Simple dot product with itself
        var dot = x*x+y*y+z*z;
        var b = x*ray.direction.x+y*ray.direction.y+z*ray.direction.z;
        var discriminant = b*b - dot + this.radius*this.radius;

        // This variable holds the final position
        // where we are.
        var where = 0;
        if(discriminant>0){
            var d = Math.sqrt(discriminant);
            var root_1 = b-d;
            var root_2 = b+d;

            if(root_2>0){
                if(root_1<0){
                    if(root_2<distance){
                        distance = root_2;
                        where = -1;
                    }
                }else{
                    if(root_1<distance){
                        distance = root_1;
                        where = 1;
                    }
                }
            }
        }
        return {
            type: where,
            dist: distance
        }
        // Alternative implementation that misses
        // a bit to work correctly and it's probably
        // more efficient
        /*
            var A = ray.direction.x*ray.direction.x+ray.direction.y*ray.direction.y+ray.direction.z*ray.direction.z;
            var B = -2 * (ray.direction.x*x + ray.direction.y*y + ray.direction.z*z);
            var C = (x*x+y*y+z*z) - Math.sqrt(this.radius);
            var radical = B*B - 4*A*C;

            // optimization
            if(radical<0){
                return false;
            }

            radical = Math.sqrt(radical);

            var t_m = (-B - radical)/(2*A);
            var t_p = (-B + radical)/(2*A);

            var where = 1;

            return {
                type: where,
                dist: t_p
            }
        */
    }
    
    // Here is the real interesting part AKA where 
    // rays are traced. It's called by trace scene
    // using O(width*height) ~ O(n^2) iterations.
    Scene.prototype.trace_ray = function(ray, bounces) {
        var object = null,
            color = new RGB(0, 0, 0),
            distance = +Infinity;

        // Iterate over the objects and choose one that
        // minimizes the ray-object intersection distance.
        for(var i=0; i<this.objects.length; i++){
            var current_object = this.objects[i];
            var result = current_object.object.intersect(ray);

            if(result.type && (object === null || result.dist < distance)){
                object = current_object;
                distance = result.dist;
            }
        }

        // We have hit something, so let's get procceed
        if(object){
            // let's calculate the point in the object where we intersect
            var x = ray.origin.x + ray.direction.x*distance,
                y = ray.origin.y + ray.direction.y*distance,
                z = ray.origin.z + ray.direction.z*distance;

            var normal = object.object.normal_to_point(x, y, z);

            // let's now iterate over the lights and compute interesting

            // things such as shadows, reflections...
            for(var i=0; i<this.lights.length; i++){

                var current_light = this.lights[i];

                // vector from intersection point to light
                var light_x = current_light.object.center.x - x,
                    light_y = current_light.object.center.y - y,
                    light_z = current_light.object.center.z - z;

                // Get the normal

                // Maybe abstract this away
                var magnitude = Math.sqrt(
                    light_x*light_x +
                    light_y*light_y +
                    light_z*light_z
                );

                light_x /= magnitude;
                light_y /= magnitude;
                light_z /= magnitude;

                // Compute shadows with the following algoritm:
                // trace a ray from the intesection of the ray-object to
                // the light and check if light's distance is decreased.
                var point_to_light_distance = Math.sqrt(
                    (x-current_light.object.center.x) * (x-current_light.object.center.x) +
                    (y-current_light.object.center.y) * (y-current_light.object.center.y) +
                    (z-current_light.object.center.z) * (z-current_light.object.center.z)
                );

                var shadow_ray = new Ray();
                shadow_ray.origin = new Vec3f(x, y, z);
                // We ned an epsilon value to be added so floating
                // point aritmetic accuracy does not mess up with our
                // graphics
                shadow_ray.origin.x += light_x/10000;
                shadow_ray.origin.y += light_y/10000;
                shadow_ray.origin.z += light_z/10000;

                // We already computed the direction of the ray
                shadow_ray.direction = new Vec3f(light_x, light_y, light_z);

                // let's check whether if we intersect some object
                var in_shadow = false;

                for(var j=0; j<this.objects.length; j++){
                    var current_object = this.objects[j];
                    var result = current_object.object.intersect(shadow_ray);

                    if(result.type && result.dist < point_to_light_distance){
                        in_shadow = true;
                        break;
                    }
                }

                // Skip light
                if(in_shadow){
                    continue;
                }

                // Now let's compute reflection, diffuse and specular
                // shading

                // Diffuse shading
                var cosine = normal.x * light_x +
                    normal.y * light_y +
                    normal.z * light_z;
                
                if (cosine < 0) cosine = 0;

                color.r += cosine * object.color.r * current_light.color.r;
                color.g += cosine * object.color.g * current_light.color.g;
                color.b += cosine * object.color.b * current_light.color.b;

                // Specular shading with Phong
                if(object.specularity > 0){
                    var vrx = light_x - normal.x * cosine * 2,
                        vry = light_y - normal.y * cosine * 2,
                        vrz = light_z - normal.z * cosine * 2;

                    var cos_sigma = ray.direction.x*vrx +
                        ray.direction.y*vry +
                        ray.direction.z*vrz;

                    if(cos_sigma > 0){
                        var specularity = object.specularity;
                        var power = Math.pow(cos_sigma, 64);

                        color.r += current_light.color.r * specularity * power;
                        color.g += current_light.color.g * specularity * power;
                        color.b += current_light.color.b * specularity * power;
                    }
                }

                // Reflection recursing over the scene if does not exceed the max
                if (ENABLE_REFLECTIONS && 
                        object.reflection > 0 
                        && bounces < MAX_REFLECTION_RECURSION) {
                    var recursive_ray = new Ray();
                    var dotnr = (ray.direction.x * normal.x) +
                                (ray.direction.y * normal.y) +
                                (ray.direction.z * normal.z);
                    recursive_ray.origin = new Vec3f(x,y,z);
                    recursive_ray.direction = new Vec3f(ray.direction.x - 2 * normal.x * dotnr,
                                     ray.direction.y - 2 * normal.y * dotnr,
                                     ray.direction.z - 2 * normal.z * dotnr);
                    recursive_ray.origin.x += recursive_ray.direction.x / 10000;
                    recursive_ray.origin.y += recursive_ray.direction.y / 10000;
                    recursive_ray.origin.z += recursive_ray.direction.z / 10000;


                    var recursive_color = this.trace_ray(recursive_ray, bounces+1);
                    
                    color.r *= 1-object.reflection;
                    color.g *= 1-object.reflection;
                    color.b *= 1-object.reflection;

                    color.r += recursive_color.color.r * object.reflection;
                    color.g += recursive_color.color.g * object.reflection;
                    color.b += recursive_color.color.b * object.reflection;
                }

                
            }
            

            if(color.r > 1){ color.r = 1; }
            if(color.g > 1){ color.g = 1; }
            if(color.b > 1){ color.b = 1; }
        }else{
            // No hit
            color = new RGB(1, 1, 1);
        }

        return {
            obj: object,
            color: color
        };
    };
    
    // Called from render function returned from
    // the initializer by the user.
    // Iterates over the screen pixel's, shoots rays
    // and test for the intersection
    Scene.prototype.trace_scene = function(pov) {
        var ray = new Ray();
        ray.origin = pov;

        for(var x=0; x<SCREEN_WIDTH; x++){
            for(var y=0; y<SCREEN_HEIGHT; y++){
                ray.direction = new Vec3f(
                    (x-SCREEN_WIDTH/2)/100,
                    (y-SCREEN_HEIGHT/2)/100,
                    4 // (0-800/2)/100 ~> dehardcode it
                ).normalize();

                // shoots the ray and use the result
                var trace = this.trace_ray(ray, 0);
                var offset = x*4+y*4*SCREEN_WIDTH;

                pixels.data[offset+0] = trace.color.r*255;
                pixels.data[offset+1] = trace.color.g*255;
                pixels.data[offset+2] = trace.color.b*255;
                pixels.data[offset+3] = 255; // alpha transparency
            }
        }
    }

    // Helper function to log info/ debug messages
    function log(message){
        console.log('[info] ', message);
    }
    return initialize(); 
};



// Vector implementation
var Vec3f = function(x, y, z){
    this.x = x || 0; 
    this.y = y || 0;
    this.z = z || 0;
}
// Includes basic magnitude calculation as well 
// as normalization as it's quite used.
Vec3f.prototype = {
    magnitude: function(){
        return Math.sqrt(
            this.x*this.x +
            this.y*this.y +
            this.z*this.z
        );
    },

    normalize: function(){
        var m = this.magnitude();
        this.x /= m;
        this.y /= m;
        this.z /= m;

        return this;
    }
}

// Ray implementation
var Ray = function(){
    this.origin = new Vec3f();
    this.direction = new Vec3f();
}

// Light ray.
var Light = function(){
    this.type = 'light';
    this.center = new Vec3f();
}

// RGB color helper
var RGB = function(r, g, b){
    this.r = r;
    this.g = g;
    this.b = b;
}

// Generic Object implementation
var Object = function(name, object){
    this.name = name;
    this.object = object;
    this.color = new RGB();
    this.specular = 0;
    this.reflect = 0;
}

// Sphere
var Sphere = function(radius){
    this.type = 'sphere';
    this.center = new Vec3f();
    this.radius = radius || 1.0;
}

// Scene composed of objects and lights
var Scene = function(){
    this.objects = [];
    this.lights = [];
}

Scene.prototype = {
    add_object: function(object){
        this.objects.push(object);
        return object;
    },
    add_light: function(light){
        this.lights.push(light);
        return light;
    }
}

var hex_to_rgb = function(hex){
    hex = hex.replace('#','');

    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);

    return new RGB(r/255, g/255, b/255);
}

// Taken from https://gist.github.com/lrvick/2080648
var rgb_to_hex = function(r, g, b){
    var bin = r*255 << 16 | g*255 << 8 | b*255;
    return (function(h){
        return new Array(7-h.length).join("0")+h
    })(bin.toString(16).toUpperCase())
}

var underscorify = function(string){
    return string.replace(' ', '_');
}


// Some very basic ui for controlling parameters
// in a realtime-ish fashion
var RaytracerUI = function(scene, element){
    var element = document.querySelector(element);

    // Create the objects interface
    for(var i=0; i<scene.objects.length; i++){
        var object = scene.objects[i];
        var selector = underscorify(object.name) + '_color';

        element.innerHTML += `
            <div class="ui-control">
                <input type="color" id="${selector}" name="favcolor" value="#${rgb_to_hex(object.color.r, object.color.g, object.color.b)}">
                <span class="name">${object.name}</span>
                <span class="type">=> ${object.object.type}</>
            </div>`;
    }
    // Add divider
    element.innerHTML += `<div class="divider"></div>`

    // Create the lights interface. Probably can be 
    // merged with the objects code but let's see
    for(var i=0; i<scene.lights.length; i++){
        var current_light = scene.lights[i];
        var selector = underscorify(current_light.name) + '_color';

        element.innerHTML += `
            <div class="ui-control">
                <input type="color" id="${selector}" name="favcolor" value="#${rgb_to_hex(current_light.color.r, current_light.color.g, current_light.color.b)}">
                <span class="name">${current_light.name}</span>
                <span class="type">=> ${current_light.object.type}</>
            </div>`;
    }   

    // Add events for both
    for(var j=0; j<scene.objects.length; j++){
        var object = scene.objects[j];
        var selector = underscorify(object.name) + '_color';


        document.getElementById(selector).addEventListener(
            'input',
            (function(object) {
                return function(event){
                    var value = this.value;
                    var rgb = hex_to_rgb(value);

                    object.color = rgb;
                    rt.render(scene, new Vec3f(0, 0, -2));
                    //log('color of ', object.name ,' value ', rgb);
                }
            })(object) // ugh, js. Thx @frozenball :)
        );
    }

    for(var j=0; j<scene.lights.length; j++){
        var current_light = scene.lights[j];
        var selector = underscorify(current_light.name) + '_color';


        document.getElementById(selector).addEventListener(
            'input',
            (function(current_light) {
                return function(event){
                    var value = this.value;
                    var rgb = hex_to_rgb(value);

                    current_light.color = rgb;
                    rt.render(scene, new Vec3f(0, 0, -2));
                    //log('color of ', current_light.name ,' value ', rgb);
                }
            })(current_light) // ugh, js. Thx @frozenball :)
        );
    }
}
