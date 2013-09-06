


	var ResourcePool 	= require( "./" )
		, log 			= require( "ee-log" )
		, Class			= require( "ee-class" )
		, idCounter 	= 0
		, jobsDone 		= 0;


	var Resource = new Class( {

		init: function(){	
			this.id = ++idCounter;
		}


		, do: function(){
			log( "resource %s is beeing used ...", this.id );
			setTimeout( function(){
				log( "resource %s is beeing freed, job %s completed ...", this.id, ++jobsDone );
				this.freeResource();
			}.bind( this ), 2000 );
		}
	} );



	var pool = new ResourcePool( {
		  maxWaitingRequests: 10000
		, timeout: 3600000
	} );


	for( var i = 0, l = 10; i < l; i++ ){
		pool.add( new Resource() );
	}



	for( var i = 0, l = 100; i < l; i++ ){
		pool.get( function( err, res ){
			log.trace( err );
			if ( res ) res.do();
		} );
	}