

	var   Class 		= require( "ee-class" )
		, EventEmitter 	= require( "ee-event-emitter" )
		, Queue 		= require( "ee-ttl-queue" )
		, log 			= require( "ee-log" );


	var Resource 		= require( "./Resource" );




	module.exports = new Class( {
		inherits: EventEmitter


		// there should always be x percent resources in stock, so we've never to wait when whe request one
		// default: 0 -> no prefetching
		, prefetch: 0

		// how long should it take to emit a timeout error for a resource request ( ms )
		// default: 0 -Y no timeout
		, timeout: 0

		// free resources ( close them ) after x ms
		// default: 0 -> resources will never bee freed
		, idle: 0

		// maximum resources which may be allocated by the pool ( via the «resouceRequest» event )
		// default: 0 -> no limit
		, max: 0

		// maximum number of resource requests / second
		// default: 0 -> no limit
		, ratelLimit: 0


		, surplusResourcePercent: 	15 // 15%
		, idleTTL: 600 	// 10 minutes ( remove resources abobe the 15% surplus after 10 minutes of idling )
		, maxResourceRequestsPerSecond: 0 // dont request more than 5 new resources / second
		, lastResourceRequestTimestamp: 0

		, resources: []
		, busyCount: 0
		, requestedCount: 0


		, init: function( options ){
			if ( options.surplusResourcePercent ) 		this.surplusResourcePercent = options.surplusResourcePercent;
			if ( options.idleTTL ) 						this.idleTTL = options.idleTTL;
			if ( options.maxResourceRequestsPerSecond ) this.maxResourceRequestsPerSecond = options.maxRequestsPerSecond;
			if ( options.maxResources ) 				this.mayResources = options.maxResources;

			this.queue = new Queue( {
				  max: 10000
				, ttl: options.requestTimeout || 5000
				, on: {
					timeout: this.handleQueueTimeout.bind( this )
					, error: this.handleQueueOverflow.bind( this )
				}
			} );

			this.requestResoure();
		}


		, handleQueueTimeout: function( callback ){
			callback( new Error( "Timeout while waiting for a free resource." ).setName( "CapacityOverloadException" ) );
		}

		, handleQueueOverflow: function( error ){
			log.trace( err );
		}


		, add: function( resource ){
			this.busyCount++;
			new Resource( { 
				resource: resource 
				, on: {
					  free: this.onFreeResource.bind( this )
					, busy: this.onBusyResource.bind( this )
				}
			} );
		}


		, onFreeResource: function( resource ){
			this.busyCount--;

			if ( this.queue.length > 0 ){
				this.queue.get()( null, resource.use() );
			}
			else this.resources.push( resource );
		}


		, onBusyResource: function( resource ){
			this.busyCount++;

			this.requestResoure();
		}


		, requestResoure: function(){
			// need to request more resources ?
			if ( this.ratioResuested < this.surplusResourcePercent ){
				this.requestedCount++;
				this.emit( "resourceRequest", this.handleRequestedResource.bind( this ) );
			}
		}


		, handleRequestedResource: function( resource ){
			this.requestedCount--;
			if ( resource ) this.add( resource );
		}


		, get: function( callback ){
			if ( this.free > 0 ) {
				var res = this.resources.shift();
				callback ( null, res.use() );
			}
			else {
				if ( !this.queue.queue( callback ) ){
					callback( new Error( "Failed to queue request for resource, queue overflow." ).setName( "CapacityOverloadException" ) );
				}
			}
		}


		, get free(){
			return this.resources.length;
		}

		, get busy(){
			return this.busyCount;
		}

		, get resourceCount(){
			return this.busy + this.free;
		}

		, get freeRatio(){
			return Math.round( this.free / ( this.busy + this.free ) * 10000 ) / 100
		}

		, get requestedRatio(){
			return Math.round( ( this.free + this.requestedCount ) / ( this.busy + this.free + this.requestedCount ) * 10000 ) / 100
		}
	} );