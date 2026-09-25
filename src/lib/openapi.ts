import { FILTERS } from './demande-query';
const errorResponses = {
  '400': {description:'Identifiant ou filtres invalides'},
  '401': {description:'Session ou jeton invalide, compte inactif ou rôle non autorisé'},
  '500': {description:'Service momentanément indisponible'},
};
const parameter = (name:string, schema:object, description:string) => ({name,in:'query',required:false,schema,description});
export const openapi = {
  openapi:'3.0.3', info:{title:'Camionnage — API de lecture',version:'2.1.0',description:'Demandes et opérations. Authentification par JWT utilisateur Supabase ou cookie de session. Aucun accès anonyme, aucune clé service_role. Rôles : coordinateur, dispatcheur, direction, admin, gm, emballage. Aucune écriture dans cette version.'},
  servers:[{url:'/'}], security:[{bearerAuth:[]},{sessionCookie:[]}],
  paths:{
    '/api/v1/demandes':{get:{operationId:'listDemandes',summary:'Liste paginée des demandes / export de la page',parameters:[
      parameter('f',{type:'string',enum:FILTERS.map(f=>f.key),default:'actives'},'Groupe de statuts'),
      parameter('q',{type:'string',maxLength:100},'Recherche dans numéro, code affaire et objets ; accents conservés, ponctuation spéciale ignorée'),
      parameter('client',{type:'string',format:'uuid'},'Identifiant du client'),
      parameter('mine',{type:'string',enum:['0','1'],default:'0'},'Limiter au coordinateur connecté'),
      parameter('from',{type:'string',format:'date'},'Date souhaitée minimum incluse'),
      parameter('to',{type:'string',format:'date'},'Date souhaitée maximum incluse'),
      parameter('page',{type:'integer',minimum:1,maximum:100000,default:1},'Page'),
      parameter('limit',{type:'integer',minimum:1,maximum:100,default:50},'Nombre de demandes par page'),
      parameter('format',{type:'string',enum:['json','csv'],default:'json'},'JSON ou CSV de cette page uniquement (UTF-8 BOM, séparateur point-virgule)'),
    ],responses:{'200':{description:'Demandes accessibles à cet utilisateur ; données métier et total',content:{'application/json':{schema:{$ref:'#/components/schemas/DemandeList'}},'text/csv':{schema:{type:'string'}}},headers:{'X-Total-Count':{description:'Nombre total de résultats filtrés (CSV)',schema:{type:'integer'}}}},...errorResponses}}},
    '/api/v1/demandes/{id}':{get:{operationId:'getDemande',summary:'Détail de la demande, opérations, camions et équipes',parameters:[{name:'id',in:'path',required:true,schema:{type:'string',format:'uuid'}}],responses:{'200':{description:'Détail',content:{'application/json':{schema:{type:'object',required:['data'],properties:{data:{$ref:'#/components/schemas/DemandeDetail'}}}}}},'404':{description:'Demande introuvable'},...errorResponses}}},
  },
  components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'Supabase access_token'},sessionCookie:{type:'apiKey',in:'cookie',name:'sb-<project-ref>-auth-token',description:'Cookie Supabase SSR de la session navigateur, éventuellement découpé en plusieurs cookies. Son nom dépend du projet.'}},schemas:{
    DemandeSummary:{type:'object',required:['id','numero','etat'],properties:{id:{type:'string',format:'uuid'},numero:{type:'string'},etat:{type:'string',enum:['brouillon','envoyee','acceptee','planifiee','en_cours','terminee','refusee','annulee']},code_affaire:{type:'string',nullable:true},date_souhaitee:{type:'string',format:'date',nullable:true},client:{type:'object',nullable:true,properties:{nom:{type:'string'}}},operations:{type:'array',items:{type:'object',properties:{id:{type:'string',format:'uuid'},etat:{type:'string'}}}}},additionalProperties:true},
    DemandeDetail:{allOf:[{$ref:'#/components/schemas/DemandeSummary'},{type:'object',properties:{adresse_enlevement:{type:'string',nullable:true},adresse_livraison:{type:'string',nullable:true},objets:{type:'string',nullable:true},observations:{type:'string',nullable:true},operations:{type:'array',items:{type:'object',additionalProperties:true,description:'Champs métier de l’opération, camion affecté et tableau des équipiers.'}}}}]},
    DemandeList:{type:'object',required:['data','pagination'],properties:{data:{type:'array',items:{$ref:'#/components/schemas/DemandeSummary'}},pagination:{type:'object',required:['page','limit','total','has_more'],properties:{page:{type:'integer'},limit:{type:'integer'},total:{type:'integer'},has_more:{type:'boolean'}}}}},
  }},
};
