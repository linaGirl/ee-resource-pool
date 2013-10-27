

	var   Class 		= require( "ee-class" )
		, EventEmitter 	= require( "ee-event-emitter" )
		, Queue 		= require( "ee-ttl-queue" )
		, type 			= require( "ee-types" )
		, RateLimiter 	= require( "ee-rate-limiter" )
		, log 			= require( "ee-log" );


	var Resource 		= require( "./Resource" );




	module.exports = new Class( {
		inherits: EventEmitter


		// there should always be x percent resources in stock, so we've never to wait when whe request one
		// default: 0 -> no prefetching
		, prefetch: 0

		// how long should it take to emit a timeout error for a resource request ( ms )
		// default: 0 -> no timeout
		, timeout: 0

		// maximum # of waiting requests
		// default: 100'000 
		, maxWaitingRequests: 100000

		// free resources ( close them ) after x ms
		// default: 0 -> resources will never bee freed
		, idle: 0

		// maximum resources which may be allocated by the pool ( via the «resouceRequest» event )
		// default: 0 -> no limit
		, max: 0

		// maximum number of resource requests / second
		// default: 0 -> no limit
		, ratelLimit: 0


		// references to all free resources
		, resources: []



		// number of busy resources
		, busy: 0

		// number of requested resources
		, requested: 0

		// number of free resources
		, free: 0

		// number of total resources
		, get total(){ return this.busy + this.free }

		// percent of free resources
		, get freePercent(){ return this.free / this.total * 100; }

		// percent of busy resources
		, get busyPercent(){ return this.busy / this.total * 100; }

		// percent of prefetched resources in relation to the number of currently busy or waiting jobs
		, get prefetchPercent(){ return this.queue.length + this.busy === 0 ? 0 : ( this.free + this.requested ) / ( this.queue.length + this.busy ) * 100; }



		, init: function( options ){
			if ( type.number( options.prefetch ) ) 				this.prefetch 			= options.prefetch;
			if ( type.number( options.timeout ) ) 				this.timeout 			= options.timeout;
			if ( type.number( options.idle ) ) 					this.idle 				= options.idle;
			if ( type.number( options.max ) ) 					this.max 				= options.max;
			if ( type.number( options.ratelLimit ) ) 			this.ratelLimit 		= options.ratelLimit;
			if ( type.number( options.maxWaitingRequests ) ) 	this.maxWaitingRequests = options.maxWaitingRequests;

			this.queue = new Queue( {
				  max: this.maxWaitingRequests
				, ttl: this.timeout
				, on: {
					timeout: this.handleQueueTimeout.bind( this )
					, error: this.handleQueueOverflow.bind( this )
				}
			} );

			// support for rate lmimting
			this.rate = new RateLimiter( { rate: this.ratelLimit } );

			// start loading resources whne there is nede to prefetch them
			process.nextTick( function(){
				this.requestResoure();
			}.bind( this ) );
		}


		, handleQueueTimeout: function( callback ){
			callback( new Error( "Timeout while waiting for a free resource" ).setName( "CapacityOverloadException" ) );
		}

		, handleQueueOverflow: function( error, callback ){
			callback( new Error( "Error while queueing resource" ).setName( "CapacityOverloadException" ) );
		}


		, add: function( resource ){
			this.busy++;
			new Resource( { 
				  resource: resource 
				, idleTimeout: this.idle
				, on: {
					  free: this.onFreeResource.bind( this )
					, busy: this.onBusyResource.bind( this )
					, close: this.onCloseResource.bind( this )
				}
			} );
		}


		, onCloseResource: function( resource ){
			if ( resource.busy ) this.busy--;
			else {
				var idx = this.resources.indexOf( resource );
				if ( idx >= 0 ) this.resources.splice( idx, 1 );
				else throw new Error( "failed to remove resources from free resources!" );
				this.free--;
			}
		}


		, onFreeResource: function( resource ){
			this.busy--;
			this.free++;

			if ( this.queue.length > 0 && this.rate.ok() ){
				this.queue.get()( null, resource.use() );
			}
			else this.resources.push( resource );
		}


		, onBusyResource: function( resource ){
			this.busy++;
			this.free--;

			this.requestResoure();
		}


		, requestResoure: function(){
			// get more resources if required and allowed
			if ( ( this.queue.length > 0 || ( this.prefetch > 0 && this.prefetchPercent < this.prefetch ) ) && ( this.max === 0 || ( this.total + this.requested ) < this.max ) ){
				this.requested++;
				this.emit( "resourceRequest", this.handleRequestedResource.bind( this ) );
			}
		}


		, handleRequestedResource: function( resource ){
			this.requested--;
			if ( resource ) this.add( resource );
		}



		, get: function( callback ){
			if ( this.free > 0 && this.rate.ok() ) {
				var res = this.resources.shift();
				callback ( null, res.use() );
			}
			else this.queue.queue( callback );
		}
	} );