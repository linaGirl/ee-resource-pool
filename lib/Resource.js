

	var   Class = require( "ee-class" )
		, log 	= require( "ee-log" );


	module.exports = new Class( {

		init: function( options ){
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
			thi.emit( "free", this );
		} 
	} );