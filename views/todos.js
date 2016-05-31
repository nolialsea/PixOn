/*global $*/
/*global io*/
$("#alertLogin").hide();
$("#formTask").hide();

Date.prototype.yyyymmdd = function() {
 var yyyy = this.getFullYear().toString();
 var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
 var dd  = this.getDate().toString();
 var hh = this.getHours().toString();
 var MM = this.getMinutes().toString();
 var ss = this.getSeconds().toString();
 return yyyy + "-" + (mm[1]?mm:"0"+mm[0])+ "-" + (dd[1]?dd:"0"+dd[0]) + " " +
  (hh[1]?hh:"0"+hh[0]) + ":" + (MM[1]?MM:"0"+MM[0]) + ":" + (ss[1]?ss:"0"+ss[0]); // padding
};

/* Create an array with the values of all the select options in a column */
$.fn.dataTable.ext.order['dom-select'] = function  ( settings, col ){
    return this.api().column( col, {order:'index'} ).nodes().map( function ( td, i ) {
        return $('select', td).val();
    } );
}

var t = $('#tasks').DataTable( {
  "order": [[ 3, "desc" ]],
  "columns": [
    { "width": "20%", "orderDataType": "dom-select" },
    { "width": "50%" },
    { "width": "10%", "orderDataType": "dom-select" },
    { "width": "10%" },
    { "width": "10%" }
  ]
});

var socket = io(); // TIP: io() with no args does auto-discovery

var userLogin = "";
var userId = 0;

socket.emit('getAllTasks');

$("#formTask").on("submit", function(e){
    e.preventDefault();
    if ($("#inpTask").val() != null && $("#inpTask").val() != ""){
        socket.emit('task', {task: $("#inpTask").val(), feature: $("#inpFeature").val()});
    }
    $("#inpTask").val("");
});

$("#formLogin").on("submit", function(e){
  e.preventDefault();
  var login = $("#inputLogin").val();
  var password = $("#inputPassword").val();
  socket.emit('login', {login: login, password: password});
});

function changeTaskState(taskId, taskStateId){
  socket.emit('changeTaskState', {taskId: taskId, taskStateId: taskStateId});
}

function changeTaskFeature(taskId, taskFeatureId){
  socket.emit('changeTaskFeature', {taskId: taskId, taskFeatureId: taskFeatureId});
}

function addTask(task){
  var htmlState = "";
  if (task.owner == userId){
    htmlState = '<select class="form-control" onchange="changeTaskState('+task.id+',parseInt($(this).val()))">';
    for (var i=1; i<state.length; i++){
      htmlState += '<option value="'+i+'" '+(task.state == i ? "selected" : "")+'> '+state[i]+' </option>';
    }
    htmlState += '</select>';
  }else{
    htmlState = state[task.state];
  }

  var htmlFeature = "";
  if (task.owner == userId){
    htmlFeature = '<select class="form-control" onchange="changeTaskFeature('+task.id+',parseInt($(this).val()))">';
    for (var i=1; i<feature.length; i++){
      htmlFeature += '<option value="'+i+'" '+(task.feature == i ? "selected" : "")+'> '+feature[i]+' </option>';
    }
    htmlFeature += '</select>';
  }else{
    htmlFeature = feature[task.feature];
  }

  t.row.add([
    htmlFeature,
    task.task,
    htmlState,
    new Date(task.dateCreation).yyyymmdd(),
    task.owner+' <button type="button" onclick="removeTask('+task.id+')" class="btn btn-default btn-xs pull-right" aria-label="Left Align"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></button>'
  ]).draw(false);
}

function removeTask(id){
    socket.emit('deleteTask', id);
}

socket.on('task', function(task){
    addTask(task);
});

socket.on('login', function(id){
    if (id){
      $("#alertLogin").hide();
      $("#formTask").show();
      userId = id;
      $("#formLogin").html("<h4>"+$("#inputLogin").val()+"</h4");
    }else{
      $("#alertLogin").show();
      $("#formTask").hide();
    }
});

socket.on('allTasks', function(tasks){
    t.rows().remove().draw();
    for (var i=0; i<tasks.length; i++){
        addTask(tasks[i]);
    }
});
