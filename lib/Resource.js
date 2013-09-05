

	var   Class 		= require( "ee-class" )
		, EventEmitter 	= require( "ee-event-emitter" )
		, log 			= require( "ee-log" );


	module.exports = new Class( {
		inherits: EventEmitter

		, init: function( options ){
			this.resource = options.resource;
			this.resource.freeResource = this.free.bind( this );

			this.busy = false;

			this.free();
		}

		, use: function(){
			this.busy = true;
			this.emit( "busy", this );
			return this.resource;
		}


		, free: function(){
			this.emit( "free", this );
		} 
	} );