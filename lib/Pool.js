

	var   Class 		= require( "ee-class" )
		, EventEmitter 	= require( "ee-event-emitter" )
		, Queue 		= require( "ee-ttl-queue" )
		, log 			= require( "ee-log" );


	var Resource 		= require( "./Resource" );




	module.exports = new Class( {
		inherits: EventEmitter

		, surplusResourcePercent: 	15 // 15%
		, idleTTL: 600 	// 10 minutes ( remove resources abobe the 15% surplus after 10 minutes of idling )
		, maxResourceRequestsPerSecond: 5 // dont request more than 5 new resources / second
		, lastResourceRequestTimestamp: 0

		, resources: []
		, busyCount: 0
		, requestedCount: 0


		, init: function( options ){
			if ( options.surplusResourcePercent ) this.surplusResourcePercent = options.surplusResourcePercent;
			if ( options.idleTTL ) this.idleTTL = options.idleTTL;
			if ( options.maxResourceRequestsPerSecond ) this.maxResourceRequestsPerSecond = options.maxResourceRequestsPerSecond;

			this.queue = new Queue( {
				  max: 10000
				, ttl: 5000
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

		, get freeRatio(){
			return Math.round( this.free / ( this.busy + this.free ) * 10000 ) / 100
		}

		, get requestedRatio(){
			return Math.round( ( this.free + this.requestedCount ) / ( this.busy + this.free + this.requestedCount ) * 10000 ) / 100
		}
	} );