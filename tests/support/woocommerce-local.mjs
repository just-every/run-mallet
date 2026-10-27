// Disposable provider installation. This is an opt-in journey, never a shop configuration.
import {execFileSync,spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import assert from 'node:assert/strict'

const env={...process.env}
for(const name of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[name]
const docker=(...args)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{env,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:180000}).trim()
const name='mallet-woo-'+randomUUID(),database=name+'-db',wordpress=name+'-wp',volume=name+'-data'
const directory=await mkdtemp(join(tmpdir(),'mallet-woocommerce-'))
let child,interrupted=false
const interrupt=()=>{interrupted=true;child?.kill('SIGTERM')}
process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt)
async function download(url,path){
 const response=await fetch(url,{signal:AbortSignal.timeout(120000)});assert.ok(response.ok,'Provider fixture download failed: '+response.status)
 await writeFile(path,new Uint8Array(await response.arrayBuffer()))
}
const wp=(...args)=>docker('exec',wordpress,'php','/tmp/wp-cli.phar','--allow-root',...args)
try{
 docker('info','--format','{{.ServerVersion}}')
 await Promise.all([
  download('https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar',join(directory,'wp-cli.phar')),
  download('https://downloads.wordpress.org/plugin/woocommerce.10.3.0.zip',join(directory,'woocommerce.zip'))
 ])
 docker('network','create',name)
 const gateway=docker('network','inspect',name,'--format','{{(index .IPAM.Config 0).Gateway}}')
 docker('volume','create',volume)
 docker('run','--detach','--name',database,'--network',name,'--network-alias','database',
  '-e','MARIADB_ROOT_PASSWORD=synthetic-mallet-root','-e','MARIADB_DATABASE=wordpress',
  '-e','MARIADB_USER=wordpress','-e','MARIADB_PASSWORD=synthetic-mallet-database','mariadb:11.4')
 docker('run','--detach','--name',wordpress,'--network',name,'--publish','127.0.0.1::80',
  '--mount','type=volume,src='+volume+',dst=/var/www/html',
  '--mount','type=bind,src='+directory+',dst=/tmp/mallet-fixture,readonly',
  '--mount','type=bind,src=/etc/ssl/certs/ca-certificates.crt,dst=/tmp/mallet-ca.pem,readonly',
  '-e','WORDPRESS_DB_HOST=database','-e','WORDPRESS_DB_USER=wordpress',
  '-e','WORDPRESS_DB_PASSWORD=synthetic-mallet-database','-e','WORDPRESS_DB_NAME=wordpress',
  '-e','NO_PROXY=localhost,127.0.0.1,database,'+gateway,'-e','no_proxy=localhost,127.0.0.1,database,'+gateway,
  '-e',"WORDPRESS_CONFIG_EXTRA=define('DISABLE_WP_CRON', true); $_SERVER['HTTPS'] = 'on';",
  'wordpress:6.8.3-php8.3-apache')
 const port=docker('inspect',wordpress,'--format','{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}')
 const origin='http://127.0.0.1:'+port
 for(let attempt=0;;attempt++){
  try{const response=await fetch(origin,{redirect:'manual'});if(response.status<500)break}catch{}
  assert.ok(attempt<60,'Disposable WordPress did not become ready')
  await new Promise(resolve=>setTimeout(resolve,1000))
 }
 docker('exec',wordpress,'cp','/tmp/mallet-fixture/wp-cli.phar','/tmp/wp-cli.phar')
 wp('core','install','--url='+origin,'--title=Synthetic Mallet shop','--admin_user=synthetic-mallet-owner',
  '--admin_password=synthetic-mallet-password','--admin_email=synthetic-mallet@example.test','--skip-email')
 wp('plugin','install','/tmp/mallet-fixture/woocommerce.zip','--activate')
 wp('rewrite','structure','/%postname%/')
 wp('option','update','woocommerce_currency','USD')
 wp('option','update','woocommerce_calc_taxes','no')
 // Only this disposable network gateway may receive private HTTP webhook deliveries.
 // Delivery is synchronous so the test can assert WooCommerce's actual signed request.
 await writeFile(join(directory,'fixture.php'),`<?php
add_filter('http_request_host_is_external', function ($allow, $host) { return $host === '${gateway}' ? true : $allow; }, 10, 2);
add_filter('http_allowed_safe_ports', function ($ports, $host) { return $host === '${gateway}' ? range(1024, 65535) : $ports; }, 10, 2);
add_filter('woocommerce_webhook_deliver_async', '__return_false');
add_filter('http_request_args', function ($args) { $args['sslcertificates'] = '/tmp/mallet-ca.pem'; return $args; });
add_action('woocommerce_update_order', function ($id) { file_put_contents('/tmp/mallet-webhook-results', 'updated order ' . $id . PHP_EOL, FILE_APPEND); });
add_filter('woocommerce_webhook_should_deliver', function ($deliver, $hook) { file_put_contents('/tmp/mallet-webhook-results', $hook->get_topic() . ' deliver=' . ($deliver ? 'yes' : 'no') . PHP_EOL, FILE_APPEND); return $deliver; }, 10, 2);
add_action('http_api_debug', function ($response, $context) {
 if ($context === 'response') file_put_contents('/tmp/mallet-webhook-results', is_wp_error($response) ? $response->get_error_message() . PHP_EOL : 'HTTP ' . wp_remote_retrieve_response_code($response) . PHP_EOL, FILE_APPEND);
}, 10, 2);
`)
 docker('exec',wordpress,'mkdir','-p','/var/www/html/wp-content/mu-plugins')
 docker('exec',wordpress,'cp','/tmp/mallet-fixture/fixture.php','/var/www/html/wp-content/mu-plugins/mallet-fixture.php')
 docker('exec',wordpress,'chmod','0644','/var/www/html/wp-content/mu-plugins/mallet-fixture.php')
 docker('exec','--user','www-data',wordpress,'touch','/tmp/mallet-webhook-results')
 await writeFile(join(directory,'keys.php'),`<?php
global $wpdb;
foreach ([['synthetic-mallet-consumer','synthetic-mallet-secret','read_write'],['synthetic-mallet-reader','synthetic-mallet-reader-secret','read']] as [$key,$secret,$permissions]) {
 $wpdb->insert($wpdb->prefix . 'woocommerce_api_keys', ['user_id'=>1,'description'=>'Synthetic Mallet disposable fixture','permissions'=>$permissions,'consumer_key'=>wc_api_hash($key),'consumer_secret'=>$secret,'truncated_key'=>substr($key,-7)]);
}
`)
 wp('eval-file','/tmp/mallet-fixture/keys.php')
 console.log('Disposable WooCommerce '+wp('plugin','get','woocommerce','--field=version')+'; WordPress '+wp('core','version'))
 assert.ok(!interrupted,'Disposable installation interrupted')
 child=spawn(process.execPath,['--test','--test-concurrency=1','--test-name-pattern=^STORE-002:', 'tests/mallet.test.mjs'],{
  stdio:'inherit',env:{...process.env,MALLET_WOO_ORIGIN:origin,MALLET_WOO_GATEWAY:gateway}
 })
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)})
 if(code!==0){
  // Synthetic installation only; retain the provider's delivery failure reason.
  console.error(wp('plugin','list','--status=must-use','--fields=name,status','--format=json'))
  console.error(wp('eval',"foreach (WC_Data_Store::load('webhook')->get_webhooks_ids() as $id) { $hook=wc_get_webhook($id); echo $id . ' ' . $hook->get_status() . ' failures=' . $hook->get_failure_count() . ' valid_url=' . (wp_http_validate_url($hook->get_delivery_url()) ? 'yes' : 'no') . PHP_EOL; }"))
  try{console.error(docker('exec',wordpress,'cat','/tmp/mallet-webhook-results'))}catch{}
 }
 assert.equal(code,0,'Actual WooCommerce journey failed')
}finally{
 if(child?.exitCode===null)child.kill('SIGTERM')
 for(const container of [wordpress,database])try{docker('rm','--force',container)}catch{}
 try{docker('volume','rm',volume)}catch{}
 try{docker('network','rm',name)}catch{}
 await rm(directory,{recursive:true,force:true})
 process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt)
}
